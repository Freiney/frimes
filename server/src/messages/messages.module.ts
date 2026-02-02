import { Module } from "@nestjs/common";
import { MessagesGateway } from "./messages.gateway";
import { PrismaService } from "../common/prisma.service";
import { JwtModule } from "@nestjs/jwt";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || "dev_secret",
    }),
  ],
  providers: [MessagesGateway, PrismaService],
})
export class MessagesModule {}
