import { Module } from "@nestjs/common";
import { ChatsService } from "./chats.service";
import { ChatsController } from "./chats.controller";
import { PrismaService } from "../common/prisma.service";

@Module({
  controllers: [ChatsController],
  providers: [ChatsService, PrismaService],
  exports: [ChatsService],
})
export class ChatsModule {}
