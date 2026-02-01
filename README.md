# Frimes Messenger

Полнофункциональный MVP мессенджера (web + mobile) с WebRTC звонками.

## Структура

```
/server   NestJS + Prisma + Socket.IO
/web      React + Vite + Tailwind
/mobile   Expo (React Native)
/shared   общие типы DTO и socket payload
```

## Быстрый старт (dev)

1. Подготовьте переменные окружения:

```bash
cp server/.env.example server/.env
cp web/.env.example web/.env
cp mobile/.env.example mobile/.env
```

2. Запустите Postgres и сервисы:

```bash
docker compose up postgres
```

3. Установите зависимости:

```bash
npm install
```

4. Сгенерируйте Prisma и примените миграции:

```bash
npm --workspace server run prisma:generate
npm --workspace server run prisma:migrate
npm --workspace server run prisma:seed
```

5. Запуск в dev:

```bash
npm run dev:server
npm run dev:web
npm run dev:mobile
```

## Production / Docker

```bash
docker compose up --build
```

## Сборка

### Web

```bash
npm run build:web
```

### Android APK (EAS build)

1. Установите EAS CLI:
   ```bash
   npm install -g eas-cli
   ```
2. Авторизуйтесь и соберите APK:
   ```bash
   cd mobile
   eas build --platform android --profile preview
   ```

## Звонки WebRTC

Документация по событиям, permissions и TURN — в [docs/webrtc.md](docs/webrtc.md).

## Seed данные

- alice@example.com / password123
- bob@example.com / password123
- charlie@example.com / password123

## Примечания

- Auth: JWT + refresh token (web хранится в httpOnly cookie, mobile — secure storage).
- Реалтайм: Socket.IO + WebRTC signaling.
