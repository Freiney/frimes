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

Если `npm install` падает с 403, проверьте registry и прокси (см. ниже "Troubleshooting npm 403").

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

## Troubleshooting npm 403

Если установка пакетов возвращает `403 Forbidden`, чаще всего причина — прокси/корпоративный фильтр или приватный registry в `.npmrc`.

Диагностика:

```bash
npm config get registry
npm config list -l | sed -n '1,120p'
cat ~/.npmrc 2>/dev/null || true
cat /workspaces/frimes/.npmrc 2>/dev/null || true
env | grep -E 'NPM|NODE_AUTH|HTTPS?_PROXY|NO_PROXY' || true
```

Принудительно вернуть registry npmjs:

```bash
npm config set registry https://registry.npmjs.org/
npm config delete "//registry.npmjs.org/:_authToken" || true
```

Если проект использует GitHub Packages:

```bash
# .npmrc
@OWNER:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```
