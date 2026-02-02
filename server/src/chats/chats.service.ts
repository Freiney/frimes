import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";

@Injectable()
export class ChatsService {
  constructor(private prisma: PrismaService) {}

  async listChats(userId: string) {
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

  async createDirectChat(userId: string, identifier: string) {
    const partner = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
    });
    if (!partner) {
      throw new BadRequestException("User not found");
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

  async createGroupChat(userId: string, data: { title: string; memberIds: string[]; avatarUrl?: string | null }) {
    if (data.memberIds.length === 0) {
      throw new BadRequestException("Members required");
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

  async ensureMember(userId: string, chatId: string) {
    const membership = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!membership) {
      throw new BadRequestException("Not a member");
    }
    return membership;
  }

  async listMessages(userId: string, chatId: string, cursor?: string) {
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

  private getDirectTitle(chat: any, userId: string) {
    const other = chat.members.find((member: any) => member.userId !== userId);
    return other?.user?.name || chat.title;
  }
}
