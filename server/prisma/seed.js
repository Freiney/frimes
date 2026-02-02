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
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    const passwordHash = await bcrypt.hash("password123", 10);
    const [alice, bob, charlie] = await Promise.all([
        prisma.user.upsert({
            where: { email: "alice@example.com" },
            update: {},
            create: {
                email: "alice@example.com",
                username: "alice",
                name: "Alice",
                about: "Привет! Я Алиса.",
                passwordHash,
            },
        }),
        prisma.user.upsert({
            where: { email: "bob@example.com" },
            update: {},
            create: {
                email: "bob@example.com",
                username: "bob",
                name: "Bob",
                about: "Боб на связи.",
                passwordHash,
            },
        }),
        prisma.user.upsert({
            where: { email: "charlie@example.com" },
            update: {},
            create: {
                email: "charlie@example.com",
                username: "charlie",
                name: "Charlie",
                about: "Charlie here.",
                passwordHash,
            },
        }),
    ]);
    const directChat = await prisma.chat.create({
        data: {
            type: "direct",
            title: "Alice & Bob",
            members: {
                create: [
                    { userId: alice.id },
                    { userId: bob.id },
                ],
            },
            messages: {
                create: [
                    { senderId: alice.id, body: "Привет, Боб!" },
                    { senderId: bob.id, body: "Привет, Алиса!" },
                ],
            },
        },
    });
    await prisma.chat.create({
        data: {
            type: "group",
            title: "Frimes Team",
            members: {
                create: [
                    { userId: alice.id },
                    { userId: bob.id },
                    { userId: charlie.id },
                ],
            },
            messages: {
                create: [
                    { senderId: charlie.id, body: "Всем привет!" },
                    { senderId: alice.id, body: "Добро пожаловать в Frimes!" },
                ],
            },
        },
    });
    console.log("Seeded chats", { directChatId: directChat.id });
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
