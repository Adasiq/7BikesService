#!/usr/bin/env bash
# Обновление 7BS на Raspberry Pi (запуск через pm2).
# Запуск с Pi из корня проекта:  bash scripts/deploy-pi.sh
set -e

cd "$(dirname "$0")/.."
echo "==> git pull"
git pull --ff-only

echo "==> установка зависимостей"
pnpm install

echo "==> сборка общего пакета"
pnpm build:shared

echo "==> миграции БД"
pnpm --filter @7bs/api exec prisma migrate deploy

echo "==> сборка API"
pnpm --filter @7bs/api build

echo "==> сборка веб (может занять 10-20 мин на Pi)"
pnpm --filter @7bs/web build

echo "==> перезапуск приложения (pm2)"
pm2 restart 7bs

echo "==> Готово."
