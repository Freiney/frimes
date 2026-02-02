import { Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from 'bcrypt';
import { PrismaService } from "../common/prisma.service";

const REFRESH_TTL_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async register(payload: { email: string; password: string; name: string }) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: payload.email }, { username: payload.email.split("@")[0] }] },
    });

    if (existing) {
      throw new BadRequestException("User already exists");
    }

    const username = payload.email.split("@")[0];
    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: payload.email,
        username,
        name: payload.name,
        passwordHash,
      },
    });

    return this.issueTokens(user.id);
  }

  async login(payload: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isValid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.issueTokens(user.id);
  }

  async refresh(userId: string) {
    return this.issueTokens(userId);
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  async issueTokens(userId: string) {
    const accessToken = await this.jwtService.signAsync({ sub: userId });
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, type: "refresh" },
      { expiresIn: `${REFRESH_TTL_DAYS}d` },
    );
    const refreshHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: refreshHash },
    });
    return { accessToken, refreshToken };
  }

  async validateRefreshToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; type?: string }>(token, {
        secret: process.env.JWT_SECRET || "dev_secret",
      });

      if (payload.type !== "refresh") {
        throw new UnauthorizedException("Invalid refresh token");
      }

      const tokens = await this.prisma.refreshToken.findMany({ where: { userId: payload.sub } });
      const match = await Promise.all(tokens.map((entry) => bcrypt.compare(token, entry.tokenHash)));
      if (!match.some(Boolean)) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      return payload.sub;
    } catch (error) {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }
}
