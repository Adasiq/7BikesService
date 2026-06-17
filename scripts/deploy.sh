#!/usr/bin/env bash
# Обновление 7BS на хостинге: забрать изменения, пересобрать, перезапустить.
# Запуск с сервера из корня проекта:  bash scripts/deploy.sh
set -e

cd "$(dirname "$0")/.."
echo "==> git pull"
git pull --ff-only

echo "==> установка зависимостей"
pnpm install

echo "==> сборка общего пакета"
pnpm build:shared

echo "==> генерация Prisma Client"
pnpm --filter @7bs/api exec prisma generate

echo "==> миграции БД (Neon)"
pnpm --filter @7bs/api exec prisma migrate deploy

echo "==> сборка API"
pnpm --filter @7bs/api build

echo "==> сборка веб (использует apps/web/.env.local: NEXT_PUBLIC_API_URL)"
pnpm --filter @7bs/web build

echo "==> перезапуск приложения (Passenger)"
mkdir -p tmp
touch tmp/restart.txt

echo "==> Готово. Приложение перезапущено."
