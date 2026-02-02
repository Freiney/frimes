import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { ChatsService } from "./chats.service";
import { IsArray, IsOptional, IsString } from "class-validator";

class CreateDirectChatDto {
  @IsString()
  identifier!: string;
}

class CreateGroupChatDto {
  @IsString()
  title!: string;

  @IsArray()
  memberIds!: string[];

  @IsOptional()
  @IsString()
  avatarUrl?: string | null;
}

@Controller("chats")
export class ChatsController {
  constructor(private chatsService: ChatsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Req() req: Request) {
    return this.chatsService.listChats((req.user as { sub: string }).sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post("direct")
  async createDirect(@Req() req: Request, @Body() body: CreateDirectChatDto) {
    return this.chatsService.createDirectChat((req.user as { sub: string }).sub, body.identifier);
  }

  @UseGuards(JwtAuthGuard)
  @Post("group")
  async createGroup(@Req() req: Request, @Body() body: CreateGroupChatDto) {
    return this.chatsService.createGroupChat((req.user as { sub: string }).sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get("messages")
  async listMessages(
    @Req() req: Request,
    @Query("chatId") chatId: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.chatsService.listMessages((req.user as { sub: string }).sub, chatId, cursor);
  }
}
