import { Body, Controller, Get, Query, Req, UseGuards, Put } from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { UsersService } from "./users.service";
import { IsOptional, IsString, MaxLength } from "class-validator";

class UpdateProfileDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  about?: string | null;

  @IsOptional()
  @IsString()
  avatarUrl?: string | null;
}

@Controller("users")
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@Req() req: Request) {
    return this.usersService.getProfile((req.user as { sub: string }).sub);
  }

  @UseGuards(JwtAuthGuard)
  @Put("me")
  async update(@Req() req: Request, @Body() body: UpdateProfileDto) {
    return this.usersService.updateProfile((req.user as { sub: string }).sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get("search")
  async search(@Query("q") q: string) {
    return this.usersService.searchUsers(q);
  }
}
