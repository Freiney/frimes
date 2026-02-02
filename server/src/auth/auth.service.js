"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../common/prisma.service");
const REFRESH_TTL_DAYS = 30;
let AuthService = class AuthService {
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async register(payload) {
        const existing = await this.prisma.user.findFirst({
            where: { OR: [{ email: payload.email }, { username: payload.email.split("@")[0] }] },
        });
        if (existing) {
            throw new common_1.BadRequestException("User already exists");
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
    async login(payload) {
        const user = await this.prisma.user.findUnique({ where: { email: payload.email } });
        if (!user) {
            throw new common_1.UnauthorizedException("Invalid credentials");
        }
        const isValid = await bcrypt.compare(payload.password, user.passwordHash);
        if (!isValid) {
            throw new common_1.UnauthorizedException("Invalid credentials");
        }
        return this.issueTokens(user.id);
    }
    async refresh(userId) {
        return this.issueTokens(userId);
    }
    async logoutAll(userId) {
        await this.prisma.refreshToken.deleteMany({ where: { userId } });
    }
    async issueTokens(userId) {
        const accessToken = await this.jwtService.signAsync({ sub: userId });
        const refreshToken = await this.jwtService.signAsync({ sub: userId, type: "refresh" }, { expiresIn: `${REFRESH_TTL_DAYS}d` });
        const refreshHash = await bcrypt.hash(refreshToken, 10);
        await this.prisma.refreshToken.create({
            data: { userId, tokenHash: refreshHash },
        });
        return { accessToken, refreshToken };
    }
    async validateRefreshToken(token) {
        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: process.env.JWT_SECRET || "dev_secret",
            });
            if (payload.type !== "refresh") {
                throw new common_1.UnauthorizedException("Invalid refresh token");
            }
            const tokens = await this.prisma.refreshToken.findMany({ where: { userId: payload.sub } });
            const match = await Promise.all(tokens.map((entry) => bcrypt.compare(token, entry.tokenHash)));
            if (!match.some(Boolean)) {
                throw new common_1.UnauthorizedException("Invalid refresh token");
            }
            return payload.sub;
        }
        catch (error) {
            throw new common_1.UnauthorizedException("Invalid refresh token");
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, jwt_1.JwtService])
], AuthService);
