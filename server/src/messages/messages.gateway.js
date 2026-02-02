"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagesGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const jwt_1 = require("@nestjs/jwt");
const socket_io_1 = require("socket.io");
const prisma_service_1 = require("../common/prisma.service");
const shared_1 = require("@frimes/shared");
let MessagesGateway = class MessagesGateway {
    constructor(jwtService, prisma) {
        this.jwtService = jwtService;
        this.prisma = prisma;
        this.socketUser = new Map();
        this.activeCalls = new Map();
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.auth?.token || client.handshake.headers.authorization?.split(" ")[1];
            if (!token) {
                client.disconnect();
                return;
            }
            const payload = await this.jwtService.verifyAsync(token, {
                secret: process.env.JWT_SECRET || "dev_secret",
            });
            this.socketUser.set(client.id, payload.sub);
            client.join(payload.sub);
            const memberships = await this.prisma.chatMember.findMany({ where: { userId: payload.sub } });
            memberships.forEach((member) => client.join(member.chatId));
            await this.prisma.user.update({ where: { id: payload.sub }, data: { lastSeenAt: new Date() } });
            this.server.emit(shared_1.SocketEvents.Presence, { userId: payload.sub, status: "online" });
        }
        catch (error) {
            client.disconnect();
        }
    }
    async handleDisconnect(client) {
        const userId = this.socketUser.get(client.id);
        if (userId) {
            this.socketUser.delete(client.id);
            await this.prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
            this.server.emit(shared_1.SocketEvents.Presence, { userId, status: "offline" });
        }
    }
    async typing(client, payload) {
        const userId = this.socketUser.get(client.id);
        if (!userId)
            return;
        const member = await this.prisma.chatMember.findUnique({
            where: { chatId_userId: { chatId: payload.chatId, userId } },
        });
        if (!member)
            return;
        client.to(payload.chatId).emit(shared_1.SocketEvents.Typing, { chatId: payload.chatId, userId, isTyping: payload.isTyping });
    }
    async sendMessage(client, payload) {
        const userId = this.socketUser.get(client.id);
        if (!userId)
            return;
        const member = await this.prisma.chatMember.findUnique({
            where: { chatId_userId: { chatId: payload.chatId, userId } },
        });
        if (!member)
            return;
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
        this.server.to(payload.chatId).emit(shared_1.SocketEvents.MessageSend, messagePayload);
        await this.prisma.chat.update({ where: { id: payload.chatId }, data: { updatedAt: new Date() } });
    }
    async callStart(client, payload) {
        const userId = this.socketUser.get(client.id);
        if (!userId)
            return;
        const members = await this.ensureChatMembers(payload.chatId, userId);
        if (!members)
            return;
        const current = this.activeCalls.get(payload.chatId);
        if (current && current.state !== "ended") {
            client.emit(shared_1.SocketEvents.CallReject, { chatId: payload.chatId, from: userId, reason: "busy" });
            return;
        }
        this.activeCalls.set(payload.chatId, { callers: new Set([userId]), state: "calling" });
        client.join(payload.chatId);
        client.to(payload.chatId).emit(shared_1.SocketEvents.CallStart, { ...payload, from: userId });
    }
    async callRinging(client, payload) {
        const userId = this.socketUser.get(client.id);
        if (!userId)
            return;
        await this.ensureChatMembers(payload.chatId, userId);
        client.to(payload.chatId).emit(shared_1.SocketEvents.CallRinging, { chatId: payload.chatId, from: userId });
    }
    async callAccept(client, payload) {
        const userId = this.socketUser.get(client.id);
        if (!userId)
            return;
        await this.ensureChatMembers(payload.chatId, userId);
        this.activeCalls.set(payload.chatId, { callers: new Set([userId]), state: "in_call" });
        client.join(payload.chatId);
        client.to(payload.chatId).emit(shared_1.SocketEvents.CallAccept, { chatId: payload.chatId, from: userId });
    }
    async callReject(client, payload) {
        const userId = this.socketUser.get(client.id);
        if (!userId)
            return;
        await this.ensureChatMembers(payload.chatId, userId);
        this.activeCalls.delete(payload.chatId);
        client.to(payload.chatId).emit(shared_1.SocketEvents.CallReject, { chatId: payload.chatId, from: userId, reason: payload.reason });
    }
    async callEnd(client, payload) {
        const userId = this.socketUser.get(client.id);
        if (!userId)
            return;
        await this.ensureChatMembers(payload.chatId, userId);
        this.activeCalls.delete(payload.chatId);
        this.server.to(payload.chatId).emit(shared_1.SocketEvents.CallEnd, { chatId: payload.chatId, from: userId });
    }
    async webrtcOffer(client, payload) {
        const userId = this.socketUser.get(client.id);
        if (!userId)
            return;
        await this.ensureChatMembers(payload.chatId, userId);
        client.to(payload.chatId).emit(shared_1.SocketEvents.WebRtcOffer, { ...payload, from: userId });
    }
    async webrtcAnswer(client, payload) {
        const userId = this.socketUser.get(client.id);
        if (!userId)
            return;
        await this.ensureChatMembers(payload.chatId, userId);
        client.to(payload.chatId).emit(shared_1.SocketEvents.WebRtcAnswer, { ...payload, from: userId });
    }
    async webrtcCandidate(client, payload) {
        const userId = this.socketUser.get(client.id);
        if (!userId)
            return;
        await this.ensureChatMembers(payload.chatId, userId);
        client.to(payload.chatId).emit(shared_1.SocketEvents.WebRtcIceCandidate, { ...payload, from: userId });
    }
    async ensureChatMembers(chatId, userId) {
        const membership = await this.prisma.chatMember.findUnique({
            where: { chatId_userId: { chatId, userId } },
        });
        if (!membership) {
            return null;
        }
        return membership;
    }
};
exports.MessagesGateway = MessagesGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], MessagesGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)(shared_1.SocketEvents.Typing),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], MessagesGateway.prototype, "typing", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(shared_1.SocketEvents.MessageSend),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], MessagesGateway.prototype, "sendMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(shared_1.SocketEvents.CallStart),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], MessagesGateway.prototype, "callStart", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(shared_1.SocketEvents.CallRinging),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], MessagesGateway.prototype, "callRinging", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(shared_1.SocketEvents.CallAccept),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], MessagesGateway.prototype, "callAccept", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(shared_1.SocketEvents.CallReject),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], MessagesGateway.prototype, "callReject", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(shared_1.SocketEvents.CallEnd),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], MessagesGateway.prototype, "callEnd", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(shared_1.SocketEvents.WebRtcOffer),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], MessagesGateway.prototype, "webrtcOffer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(shared_1.SocketEvents.WebRtcAnswer),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], MessagesGateway.prototype, "webrtcAnswer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(shared_1.SocketEvents.WebRtcIceCandidate),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], MessagesGateway.prototype, "webrtcCandidate", null);
exports.MessagesGateway = MessagesGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: process.env.WEB_ORIGIN || "http://localhost:5173", credentials: true },
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService, prisma_service_1.PrismaService])
], MessagesGateway);
