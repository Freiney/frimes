# Copilot Instructions for Frimes Messenger

## Архитектура и компоненты
- **/server**: NestJS backend, использует Prisma (Postgres), Socket.IO для чатов и WebRTC сигналинга. JWT-аутентификация, refresh-токены (web: httpOnly cookie, mobile: secure storage).
- **/web**: React (Vite, Tailwind), клиент для чатов и звонков, интеграция с Socket.IO и WebRTC (см. src/utils/webrtc.ts).
- **/mobile**: Expo (React Native), мобильный клиент, поддержка звонков, хранение токенов в secure storage.
- **/shared**: Общие типы DTO и socket payload для синхронизации контрактов между фронтом и бэком.

## Ключевые паттерны и соглашения
- Все события WebRTC и звонков описаны в [docs/webrtc.md](../docs/webrtc.md). Сервер валидирует JWT на каждом сокет-соединении.
- Реалтайм-логика (чаты, звонки) — через Socket.IO, сообщения и звонки разделены по gateway/controller.
- DTO и типы для сокет-сообщений и REST — только из /shared/src/index.ts.
- Для новых событий/эндпоинтов: сначала добавь типы в shared, затем реализуй на сервере и клиентах.

## Запуск и сборка
- Быстрый старт: см. [README.md](../README.md) — переменные окружения, миграции, seed, запуск сервисов.
- Dev-команды:
  - `npm run dev:server` — NestJS backend
  - `npm run dev:web` — web-клиент
  - `npm run dev:mobile` — Expo mobile
- Сборка:
  - `npm run build:web` — web production
  - `eas build --platform android` — mobile APK (см. README)
- Для звонков через TURN: запускай coturn через docker compose (см. docs/webrtc.md).

## Важные файлы и директории
- server/src/auth/* — JWT, refresh, guards
- server/src/chats/* — чаты, сообщения
- server/src/messages/* — Socket.IO gateway для сообщений
- web/src/utils/webrtc.ts — логика WebRTC на фронте
- shared/src/index.ts — типы DTO, socket payload
- docs/webrtc.md — протокол звонков, ICE servers, TURN

## Примеры паттернов
- Для нового сокет-события: определи payload в shared, добавь обработку в server/messages.gateway.ts и web/utils/webrtc.ts.
- Для новых REST-эндпоинтов: определи DTO в shared, реализуй controller/service/module в server.

## Прочее
- Seed-данные: alice@example.com, bob@example.com, charlie@example.com (пароль: password123)
- Все сервисы используют один Postgres (docker compose)
- Не дублируй типы между фронтом и бэком — всегда используй shared.
