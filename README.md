# 7BS

SaaS CRM для веломастерских с интеграцией поставщиков комплектующих.

Проектная документация: [ARCHITECTURE.md](ARCHITECTURE.md) · [API.md](API.md) · [prisma/schema.draft.prisma](prisma/schema.draft.prisma).

Развёртывание на хостинге: [DEPLOY.md](DEPLOY.md) (Beget + Neon).

## Стек

Монорепо на **pnpm workspaces**:

| Пакет | Что это | Стек |
|---|---|---|
| `apps/api` | Backend API | NestJS 11 + Prisma 6 (PostgreSQL) |
| `apps/web` | Frontend | Next.js 15 + Tailwind CSS |
| `packages/shared` | Общие типы/контракты | TypeScript + Zod |

## Требования

- Node.js >= 20 (проект собран на 24)
- pnpm (`npm i -g pnpm`)
- PostgreSQL (локально или Neon) — для фазы с БД

## Установка

```bash
pnpm install
pnpm build:shared           # собрать общий пакет (нужно перед первым запуском)
```

Для API скопируй env и сгенерируй Prisma-клиент:

```bash
cp apps/api/.env.example apps/api/.env   # заполни DATABASE_URL
pnpm --filter @7bs/api exec prisma generate
```

## Запуск (dev)

```bash
pnpm dev:api    # http://localhost:4000/api/v1
pnpm dev:web    # http://localhost:3000
```

Проверка API: `GET http://localhost:4000/api/v1/health` → `{ "status": "ok" }`.

## Сборка

```bash
pnpm build      # shared -> apps
```

## Статус

Неделя 1 (фундамент): каркас монорепо, оба приложения поднимаются, Prisma-схема
на месте. Дальше — миграция БД, JWT-auth, tenant-middleware, эндпоинты tenants
(см. план в [ARCHITECTURE.md](ARCHITECTURE.md)).
