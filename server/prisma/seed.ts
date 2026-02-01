import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

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
