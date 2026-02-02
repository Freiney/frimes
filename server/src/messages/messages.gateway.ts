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
import { Server, Socket } from "socket.io";
import { PrismaService } from "../common/prisma.service";
import { SocketEvents, CallStartPayload, WebRtcOfferPayload, WebRtcAnswerPayload, WebRtcIceCandidatePayload } from "@frimes/shared";

interface AuthPayload {
  sub: string;
}

@WebSocketGateway({
  cors: { origin: process.env.WEB_ORIGIN || "http://localhost:5173", credentials: true },
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private socketUser = new Map<string, string>();
  private activeCalls = new Map<string, { callers: Set<string>; state: string }>();

  constructor(private jwtService: JwtService, private prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers.authorization?.split(" ")[1];
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = await this.jwtService.verifyAsync<AuthPayload>(token, {
        secret: process.env.JWT_SECRET || "dev_secret",
      });
      this.socketUser.set(client.id, payload.sub);
      client.join(payload.sub);
      const memberships = await this.prisma.chatMember.findMany({ where: { userId: payload.sub } });
      memberships.forEach((member) => client.join(member.chatId));
      await this.prisma.user.update({ where: { id: payload.sub }, data: { lastSeenAt: new Date() } });
      this.server.emit(SocketEvents.Presence, { userId: payload.sub, status: "online" });
    } catch (error) {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketUser.get(client.id);
    if (userId) {
      this.socketUser.delete(client.id);
      await this.prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
      this.server.emit(SocketEvents.Presence, { userId, status: "offline" });
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
      return;
    }

    this.activeCalls.set(payload.chatId, { callers: new Set([userId]), state: "calling" });
    client.join(payload.chatId);
    client.to(payload.chatId).emit(SocketEvents.CallStart, { ...payload, from: userId });
  }

  @SubscribeMessage(SocketEvents.CallRinging)
  async callRinging(@ConnectedSocket() client: Socket, @MessageBody() payload: { chatId: string }) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;
    await this.ensureChatMembers(payload.chatId, userId);
    client.to(payload.chatId).emit(SocketEvents.CallRinging, { chatId: payload.chatId, from: userId });
  }

  @SubscribeMessage(SocketEvents.CallAccept)
  async callAccept(@ConnectedSocket() client: Socket, @MessageBody() payload: { chatId: string }) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;
    await this.ensureChatMembers(payload.chatId, userId);
    this.activeCalls.set(payload.chatId, { callers: new Set([userId]), state: "in_call" });
    client.join(payload.chatId);
    client.to(payload.chatId).emit(SocketEvents.CallAccept, { chatId: payload.chatId, from: userId });
  }

  @SubscribeMessage(SocketEvents.CallReject)
  async callReject(@ConnectedSocket() client: Socket, @MessageBody() payload: { chatId: string; reason?: string }) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;
    await this.ensureChatMembers(payload.chatId, userId);
    this.activeCalls.delete(payload.chatId);
    client.to(payload.chatId).emit(SocketEvents.CallReject, { chatId: payload.chatId, from: userId, reason: payload.reason });
  }

  @SubscribeMessage(SocketEvents.CallEnd)
  async callEnd(@ConnectedSocket() client: Socket, @MessageBody() payload: { chatId: string }) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;
    await this.ensureChatMembers(payload.chatId, userId);
    this.activeCalls.delete(payload.chatId);
    this.server.to(payload.chatId).emit(SocketEvents.CallEnd, { chatId: payload.chatId, from: userId });
  }

  @SubscribeMessage(SocketEvents.WebRtcOffer)
  async webrtcOffer(@ConnectedSocket() client: Socket, @MessageBody() payload: WebRtcOfferPayload) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;
    await this.ensureChatMembers(payload.chatId, userId);
    client.to(payload.chatId).emit(SocketEvents.WebRtcOffer, { ...payload, from: userId });
  }

  @SubscribeMessage(SocketEvents.WebRtcAnswer)
  async webrtcAnswer(@ConnectedSocket() client: Socket, @MessageBody() payload: WebRtcAnswerPayload) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;
    await this.ensureChatMembers(payload.chatId, userId);
    client.to(payload.chatId).emit(SocketEvents.WebRtcAnswer, { ...payload, from: userId });
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
}
