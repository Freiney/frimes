import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import { Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { PrismaService } from "../common/prisma.service";
import { SocketEvents, CallStartPayload, WebRtcOfferPayload, WebRtcAnswerPayload, WebRtcIceCandidatePayload } from "@frimes/shared";

interface AuthPayload {
  sub: string;
}

@WebSocketGateway({
  cors: {
    origin: (process.env.WEB_ORIGIN || "http://localhost:5175")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  },
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private socketUser = new Map<string, string>();
  private activeCalls = new Map<string, { callers: Set<string>; state: string }>();
  private logger = new Logger(MessagesGateway.name);

  constructor(private jwtService: JwtService, private prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    try {
      const authResult = this.resolveAuthToken(client);
      if (!authResult.token) {
        this.logger.warn(`Socket disconnected: missing token client=${client.id}`);
        client.disconnect();
        return;
      }
      const payload = await this.jwtService.verifyAsync<AuthPayload>(authResult.token, {
        secret: process.env.JWT_SECRET || "dev_secret",
      });
      this.socketUser.set(client.id, payload.sub);
      client.join(payload.sub);
      const memberships = await this.prisma.chatMember.findMany({ where: { userId: payload.sub } });
      memberships.forEach((member) => client.join(member.chatId));
      await this.prisma.user.update({ where: { id: payload.sub }, data: { lastSeenAt: new Date() } });
      this.server.emit(SocketEvents.Presence, { userId: payload.sub, status: "online" });
      this.logger.log(
        `Socket connected client=${client.id} user=${payload.sub} origin=${client.handshake.headers.origin} authSource=${authResult.source} auth=${JSON.stringify(client.handshake.auth)} cookie=${client.handshake.headers.cookie}`,
      );
    } catch (error) {
      this.logger.error(`Socket auth failed client=${client.id} error=${(error as Error).message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketUser.get(client.id);
    if (userId) {
      this.socketUser.delete(client.id);
      await this.prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
      this.server.emit(SocketEvents.Presence, { userId, status: "offline" });
      this.logger.log(
        `Socket disconnected client=${client.id} user=${userId} origin=${client.handshake.headers.origin}`,
      );
    }
  }

  @SubscribeMessage(SocketEvents.Typing)
  async typing(@ConnectedSocket() client: Socket, @MessageBody() payload: { chatId: string; isTyping: boolean }) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;
    const member = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: payload.chatId, userId } },
    });
    if (!member) return;
    client.to(payload.chatId).emit(SocketEvents.Typing, { chatId: payload.chatId, userId, isTyping: payload.isTyping });
    this.logger.debug(`Typing chat=${payload.chatId} from=${userId} isTyping=${payload.isTyping}`);
  }

  @SubscribeMessage(SocketEvents.MessageSend)
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string; body: string },
  ) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;
    const member = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: payload.chatId, userId } },
    });
    if (!member) return;

    const message = await this.prisma.message.create({
      data: {
        chatId: payload.chatId,
        senderId: userId,
        body: payload.body,
        status: "sent",
      },
    });

    const messagePayload = {
      id: message.id,
      chatId: payload.chatId,
      senderId: userId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      status: message.status,
      attachments: [],
    };

    this.server.to(payload.chatId).emit(SocketEvents.MessageSend, messagePayload);
    this.logger.log(`Message sent chat=${payload.chatId} from=${userId} message=${message.id}`);

    await this.prisma.chat.update({ where: { id: payload.chatId }, data: { updatedAt: new Date() } });
  }

  @SubscribeMessage(SocketEvents.CallStart)
  async callStart(@ConnectedSocket() client: Socket, @MessageBody() payload: CallStartPayload) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;
    const members = await this.ensureChatMembers(payload.chatId, userId);
    if (!members) return;

    const current = this.activeCalls.get(payload.chatId);
    if (current && current.state !== "ended") {
      client.emit(SocketEvents.CallReject, { chatId: payload.chatId, from: userId, reason: "busy" });
      this.logger.warn(`Call busy chat=${payload.chatId} from=${userId}`);
      return;
    }

    this.activeCalls.set(payload.chatId, { callers: new Set([userId]), state: "calling" });
    client.join(payload.chatId);
    client.to(payload.chatId).emit(SocketEvents.CallStart, { ...payload, from: userId });
    this.logger.log(`Call start chat=${payload.chatId} from=${userId} type=${payload.callType}`);
  }

  @SubscribeMessage(SocketEvents.CallRinging)
  async callRinging(@ConnectedSocket() client: Socket, @MessageBody() payload: { chatId: string }) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;
    await this.ensureChatMembers(payload.chatId, userId);
    client.to(payload.chatId).emit(SocketEvents.CallRinging, { chatId: payload.chatId, from: userId });
    this.logger.log(`Call ringing chat=${payload.chatId} from=${userId}`);
  }

  @SubscribeMessage(SocketEvents.CallAccept)
  async callAccept(@ConnectedSocket() client: Socket, @MessageBody() payload: { chatId: string }) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;
    await this.ensureChatMembers(payload.chatId, userId);
    this.activeCalls.set(payload.chatId, { callers: new Set([userId]), state: "in_call" });
    client.join(payload.chatId);
    client.to(payload.chatId).emit(SocketEvents.CallAccept, { chatId: payload.chatId, from: userId });
    this.logger.log(`Call accept chat=${payload.chatId} from=${userId}`);
  }

  @SubscribeMessage(SocketEvents.CallReject)
  async callReject(@ConnectedSocket() client: Socket, @MessageBody() payload: { chatId: string; reason?: string }) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;
    await this.ensureChatMembers(payload.chatId, userId);
    this.activeCalls.delete(payload.chatId);
    client.to(payload.chatId).emit(SocketEvents.CallReject, { chatId: payload.chatId, from: userId, reason: payload.reason });
    this.logger.log(`Call reject chat=${payload.chatId} from=${userId} reason=${payload.reason}`);
  }

  @SubscribeMessage(SocketEvents.CallEnd)
  async callEnd(@ConnectedSocket() client: Socket, @MessageBody() payload: { chatId: string }) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;
    await this.ensureChatMembers(payload.chatId, userId);
    this.activeCalls.delete(payload.chatId);
    this.server.to(payload.chatId).emit(SocketEvents.CallEnd, { chatId: payload.chatId, from: userId });
    this.logger.log(`Call end chat=${payload.chatId} from=${userId}`);
  }

  @SubscribeMessage(SocketEvents.WebRtcOffer)
  async webrtcOffer(@ConnectedSocket() client: Socket, @MessageBody() payload: WebRtcOfferPayload) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;
    await this.ensureChatMembers(payload.chatId, userId);
    client.to(payload.chatId).emit(SocketEvents.WebRtcOffer, { ...payload, from: userId });
    this.logger.debug(`WebRTC offer chat=${payload.chatId} from=${userId}`);
  }

  @SubscribeMessage(SocketEvents.WebRtcAnswer)
  async webrtcAnswer(@ConnectedSocket() client: Socket, @MessageBody() payload: WebRtcAnswerPayload) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;
    await this.ensureChatMembers(payload.chatId, userId);
    client.to(payload.chatId).emit(SocketEvents.WebRtcAnswer, { ...payload, from: userId });
    this.logger.debug(`WebRTC answer chat=${payload.chatId} from=${userId}`);
  }

  @SubscribeMessage(SocketEvents.WebRtcIceCandidate)
  async webrtcCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WebRtcIceCandidatePayload,
  ) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;
    await this.ensureChatMembers(payload.chatId, userId);
    client.to(payload.chatId).emit(SocketEvents.WebRtcIceCandidate, { ...payload, from: userId });
    this.logger.debug(`WebRTC ICE chat=${payload.chatId} from=${userId}`);
  }

  private async ensureChatMembers(chatId: string, userId: string) {
    const membership = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!membership) {
      return null;
    }
    return membership;
  }

  private extractTokenFromCookie(cookieHeader?: string) {
    if (!cookieHeader) return undefined;
    const parts = cookieHeader.split(";").map((part) => part.trim());
    for (const part of parts) {
      if (part.startsWith("accessToken=")) {
        return decodeURIComponent(part.replace("accessToken=", ""));
      }
    }
    return undefined;
  }

  private resolveAuthToken(client: Socket) {
    const handshakeToken = client.handshake.auth?.token as string | undefined;
    if (handshakeToken) {
      return { token: handshakeToken, source: "handshake.auth" };
    }
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return { token: authHeader.split(" ")[1], source: "authorization" };
    }
    const cookieToken = this.extractTokenFromCookie(client.handshake.headers.cookie);
    if (cookieToken) {
      return { token: cookieToken, source: "cookie" };
    }
    return { token: undefined, source: "missing" };
  }
}
