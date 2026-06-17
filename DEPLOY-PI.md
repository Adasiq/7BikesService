# Развёртывание 7BS на Raspberry Pi 3B (on-premise)

Запускаем всю систему **на самом Pi**: приложение (API + сайт в одном процессе),
локальный PostgreSQL, и публичный доступ для заказчика через Cloudflare Tunnel.

> **Honест-предупреждение.** У Pi 3B всего **1 ГБ ОЗУ**. В работе система живёт
> нормально (для теста на несколько человек), но **сборка сайта (`next build`)
> тяжёлая** — поэтому мы добавим swap и наберёмся терпения (~10–20 минут один раз).
> Если заведётся здесь — на нормальном сервере заказчика пойдёт легко.

---

## Шаг 0. Обязательно: 64-битная ОС

Prisma (доступ к БД) не работает на 32-битной системе. Проверь:

```bash
uname -m
```

Должно быть **`aarch64`**. Если `armv7l` — переустанови карту на **Raspberry Pi
OS (64-bit)** и вернись сюда.

---

## Шаг 1. Подключение

Работай прямо на Pi (монитор+клавиатура) или по SSH с ПК:

```powershell
ssh pi@<IP-адрес-Pi>
```

IP можно посмотреть на Pi командой `hostname -I`.

---

## Шаг 2. Увеличить swap до 2 ГБ (для сборки)

```bash
sudo dphys-swapfile swapoff
sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
free -h        # проверь, что Swap ~2.0Gi
```

---

## Шаг 3. Node.js и pnpm

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v        # v22.x  (нужен >= 22.13, иначе pnpm не запустится)
sudo npm install -g pnpm pm2
```

---

## Шаг 4. PostgreSQL на Pi

```bash
sudo apt update
sudo apt install -y postgresql
sudo -u postgres psql -c "CREATE USER sevenbs WITH PASSWORD 'sevenbs';"
sudo -u postgres psql -c "CREATE DATABASE sevenbs OWNER sevenbs;"
```

Строка подключения будет:
`postgresql://sevenbs:sevenbs@localhost:5432/sevenbs?schema=public`

---

## Шаг 5. Клонирование и переменные окружения

```bash
cd ~
git clone https://github.com/Adasiq/7BikesService.git 7bs
cd 7bs
```

**API** — `apps/api/.env`:

```bash
nano apps/api/.env
```

```
DATABASE_URL="postgresql://sevenbs:sevenbs@localhost:5432/sevenbs?schema=public"
JWT_ACCESS_SECRET="длинная-случайная-строка-1"
JWT_REFRESH_SECRET="длинная-случайная-строка-2"
SUPERADMIN_EMAIL="admin@7bs.local"
SUPERADMIN_PASSWORD="смени-на-надёжный"
PORT=3000
```

**Сайт** — `apps/web/.env.local` (адрес API относительный — один процесс, один домен):

```bash
nano apps/web/.env.local
```

```
NEXT_PUBLIC_API_URL="/api/v1"
```

---

## Шаг 6. Установка и сборка

```bash
cd ~/7bs
pnpm install
pnpm build:shared
pnpm --filter @7bs/api build
```

Сборка сайта — **долгая** (терпение, ~10–20 мин; работает за счёт swap):

```bash
pnpm --filter @7bs/web build
```

> Если упадёт с «killed»/нехваткой памяти — повтори так:
> `NODE_OPTIONS=--max-old-space-size=768 pnpm --filter @7bs/web build`

---

## Шаг 7. Миграции и стартовые данные

```bash
pnpm --filter @7bs/api exec prisma migrate deploy
pnpm --filter @7bs/api exec prisma db seed
```

Это создаст таблицы и аккаунты (супер-админ, тестовые поставщик и мастерская).
Каталог пока **пустой** — товары загрузим на Шаге 9.

---

## Шаг 8. Запуск через pm2 (с автозапуском)

```bash
cd ~/7bs
pm2 start server.cjs --name 7bs
pm2 save
pm2 startup        # выполни команду, которую он напечатает (sudo ...)
```

Проверь в браузере с любого устройства в той же сети:
`http://<IP-адрес-Pi>:3000` — откроется страница входа.

> Логи приложения: `pm2 logs 7bs`. Перезапуск: `pm2 restart 7bs`.

---

## Шаг 9. Загрузка каталога (прайса)

База на Pi новая, поэтому каталог надо наполнить один раз:

1. Открой `http://<IP-адрес-Pi>:3000`, войди как поставщик
   `supplier@invelum.local` / `supplier123`.
2. Раздел **«Импорт прайса»** → выбери файл `supplier-price.xlsm` (он у тебя на ПК)
   → **Загрузить**.
3. Подожди (на Pi импорт ~2–4 минуты: парсинг + ~3000 картинок в БД).

После этого каталог, категории и картинки появятся.

---

## Шаг 10. Публичный доступ через Cloudflare Tunnel

Чтобы заказчик зашёл из интернета — без проброса портов и бесплатно.

Установи cloudflared:

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
```

Быстрый туннель (даёт временный публичный `https`-адрес):

```bash
cloudflared tunnel --url http://localhost:3000
```

В выводе появится ссылка вида `https://что-то.trycloudflare.com` — её и давай
заказчику. Сайт работает через неё «как есть» (один домен, без доп. настроек).

> Чтобы туннель крутился постоянно (и переживал перезагрузку), запусти его
> тоже под pm2:
> `pm2 start cloudflared --name tunnel -- tunnel --url http://localhost:3000 && pm2 save`
>
> Минус быстрого туннеля: адрес **меняется** при каждом перезапуске. Для
> постоянного адреса нужен бесплатный аккаунт Cloudflare + свой домен (named
> tunnel) — напишу отдельно, если понадобится.

---

## Обновление при доработках

После того как мы запушили правки в GitHub — на Pi одной командой:

```bash
cd ~/7bs
bash scripts/deploy-pi.sh
```

(git pull → сборка → миграции → `pm2 restart`). Сборка сайта снова займёт время.

---

## Траблшутинг

**`uname -m` показывает armv7l.** Система 32-битная — Prisma не заработает.
Нужна 64-битная Raspberry Pi OS.

**`pnpm install` падает: `No such built-in module: node:sqlite` / «requires at
least Node.js v22.13».** Установлен Node 20. Поставь Node 22 (Шаг 3:
`setup_22.x`), затем `sudo npm install -g pnpm` и повтори.

**`next build` падает (killed).** Мало памяти. Проверь swap (`free -h`, должно быть
~2 ГБ) и собери с `NODE_OPTIONS=--max-old-space-size=768`.

**Приложение перезапускается/тормозит при импорте.** Импорт прайса требует памяти.
На Pi 3B это нормально — дождись окончания; swap поможет.

**Заказчик не открывает ссылку trycloudflare.** Туннель остановился — запусти заново
(или держи под pm2). Проверь, что приложение живо: `pm2 status`.

**Узнать IP Pi:** `hostname -I`.
