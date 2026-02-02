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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
let ChatsService = class ChatsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listChats(userId) {
        const chats = await this.prisma.chat.findMany({
            where: { members: { some: { userId } } },
            include: {
                members: { include: { user: true } },
                messages: { orderBy: { createdAt: "desc" }, take: 1, include: { attachments: true } },
            },
            orderBy: { updatedAt: "desc" },
        });
        return chats.map((chat) => {
            const lastMessage = chat.messages[0];
            return {
                id: chat.id,
                title: chat.type === "direct" ? this.getDirectTitle(chat, userId) : chat.title,
                type: chat.type,
                avatarUrl: chat.avatarUrl,
                lastMessage: lastMessage
                    ? {
                        id: lastMessage.id,
                        chatId: chat.id,
                        senderId: lastMessage.senderId,
                        body: lastMessage.body,
                        createdAt: lastMessage.createdAt.toISOString(),
                        status: lastMessage.status,
                        attachments: lastMessage.attachments.map((file) => ({
                            id: file.id,
                            url: file.url,
                            type: file.type === "image" ? "image" : "file",
                            name: file.name,
                        })),
                    }
                    : null,
                unreadCount: 0,
            };
        });
    }
    async createDirectChat(userId, identifier) {
        const partner = await this.prisma.user.findFirst({
            where: { OR: [{ email: identifier }, { username: identifier }] },
        });
        if (!partner) {
            throw new common_1.BadRequestException("User not found");
        }
        const existing = await this.prisma.chat.findFirst({
            where: {
                type: "direct",
                members: { every: { userId: { in: [userId, partner.id] } } },
            },
        });
        if (existing) {
            return existing;
        }
        return this.prisma.chat.create({
            data: {
                type: "direct",
                title: "Direct",
                members: {
                    create: [{ userId }, { userId: partner.id }],
                },
            },
        });
    }
    async createGroupChat(userId, data) {
        if (data.memberIds.length === 0) {
            throw new common_1.BadRequestException("Members required");
        }
        return this.prisma.chat.create({
            data: {
                type: "group",
                title: data.title,
                avatarUrl: data.avatarUrl,
                members: {
                    create: [{ userId }, ...data.memberIds.map((id) => ({ userId: id }))],
                },
            },
        });
    }
    async ensureMember(userId, chatId) {
        const membership = await this.prisma.chatMember.findUnique({
            where: { chatId_userId: { chatId, userId } },
        });
        if (!membership) {
            throw new common_1.BadRequestException("Not a member");
        }
        return membership;
    }
    async listMessages(userId, chatId, cursor) {
        await this.ensureMember(userId, chatId);
        const messages = await this.prisma.message.findMany({
            where: { chatId },
            include: { attachments: true },
            orderBy: { createdAt: "desc" },
            take: 30,
            ...(cursor
                ? {
                    cursor: { id: cursor },
                    skip: 1,
                }
                : {}),
        });
        return messages.map((message) => ({
            id: message.id,
            chatId: message.chatId,
            senderId: message.senderId,
            body: message.body,
            createdAt: message.createdAt.toISOString(),
            status: message.status,
            attachments: message.attachments.map((file) => ({
                id: file.id,
                url: file.url,
                type: file.type === "image" ? "image" : "file",
                name: file.name,
            })),
        }));
    }
    getDirectTitle(chat, userId) {
        const other = chat.members.find((member) => member.userId !== userId);
        return other?.user?.name || chat.title;
    }
};
exports.ChatsService = ChatsService;
exports.ChatsService = ChatsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ChatsService);
