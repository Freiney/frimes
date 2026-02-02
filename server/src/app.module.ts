import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ChatsModule } from "./chats/chats.module";
import { MessagesModule } from "./messages/messages.module";

@Module({
  imports: [
    ThrottlerModule.forRoot({
  throttlers: [
    {
      ttl: 60_000, // 60 секунд в миллисекундах
      limit: 30,
    },
  ],
}),
    AuthModule,
    UsersModule,
    ChatsModule,
    MessagesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
