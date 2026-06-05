# Развёртывание 7BS на хостинге Beget (1 сайт)

Пошаговая инструкция «с нуля»: как залить проект с GitHub на бесплатный тариф
Beget (где доступен **только один сайт**) и как обновлять его по мере доработок.

> **Как это устроено.** API (NestJS) и сайт (Next.js) запускаются **в одном
> Node-процессе на одном домене** через Passenger:
> - `/api/v1/*` и `/uploads/*` → обрабатывает NestJS (API и картинки товаров)
> - все остальные адреса → отдаёт Next.js (страницы сайта)
>
> База данных — на **Neon** (облачный Postgres), её разворачивать не нужно.
> Картинки товаров лежат на диске сервера (`apps/api/uploads`) и переживают
> обновления. Точка входа для Passenger — файл `server.cjs` в корне проекта.

---

## Обозначения

В командах заменяй плейсхолдеры:
- `USERNAME` — твой логин Beget (по скриншоту это `u4447042`)
- домашняя папка — узнаёшь командой `echo $HOME` (вид `/home/u/u4447042`)
- домен — на бесплатном тарифе технический `USERNAME.beget.tech`
  (например `u4447042.beget.tech`)

---

## Шаг 1. Подключение по SSH

Данные для SSH — в панели Beget (раздел «SSH» или «Доступ»). Из PowerShell:

```powershell
ssh USERNAME@USERNAME.beget.tech
```

Введи пароль. Проверь домашнюю папку:

```bash
echo $HOME
```

---

## Шаг 2. Установка Node.js и pnpm

На хостинге нет нужной версии Node — ставим свою в `~/.local`.

```bash
mkdir -p ~/.local && cd ~/.local
# Node.js 22 LTS (Linux x64). Если будет ошибка совместимости (GLIBC) — возьми 20 LTS.
wget https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz
tar xf node-v22.14.0-linux-x64.tar.xz --strip 1
rm node-v22.14.0-linux-x64.tar.xz
```

Добавь Node в PATH (чтобы команды работали всегда):

```bash
echo 'export PATH=$HOME/.local/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
node -v        # должно показать v22.x
```

Установи pnpm и запомни путь к node:

```bash
npm install -g pnpm
pnpm -v
which node     # например /home/u/u4447042/.local/bin/node  — пригодится в .htaccess
```

---

## Шаг 3. Клонирование проекта с GitHub

```bash
cd ~
git clone https://github.com/Adasiq/7BikesService.git 7bs
cd 7bs
```

> Если репозиторий приватный — сгенерируй ключ на сервере
> (`ssh-keygen -t ed25519`), добавь `~/.ssh/id_ed25519.pub` в GitHub →
> Settings → Deploy keys, и клонируй по SSH:
> `git clone git@github.com:Adasiq/7BikesService.git 7bs`.

---

## Шаг 4. Переменные окружения

### API — файл `apps/api/.env`

```bash
nano apps/api/.env
```

```
DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"
JWT_ACCESS_SECRET="длинная-случайная-строка-1"
JWT_REFRESH_SECRET="длинная-случайная-строка-2"
SUPERADMIN_EMAIL="admin@7bs.local"
SUPERADMIN_PASSWORD="смени-на-надёжный"
```

Сохрани: `Ctrl+O`, `Enter`, `Ctrl+X`.

### Сайт — файл `apps/web/.env.local`

Адрес API относительный (тот же домен!) — поэтому он одинаковый для любого домена:

```bash
nano apps/web/.env.local
```

```
NEXT_PUBLIC_API_URL="/api/v1"
```

> Оба файла в `.gitignore` — в репозиторий не попадут, это нормально.

---

## Шаг 5. Установка, миграции, сборка

```bash
cd ~/7bs
pnpm install
pnpm build:shared
```

> Если pnpm ругается на ключ `allowBuilds` в `pnpm-workspace.yaml` — это
> безопасно, можно проигнорировать.

Создать таблицы в БД и стартовые данные (супер-админ, тестовые поставщик и мастерская):

```bash
pnpm --filter @7bs/api exec prisma migrate deploy
pnpm --filter @7bs/api exec prisma db seed
```

> Если ты тестировал локально на **той же** базе Neon — таблицы и данные уже
> есть; команды просто ничего не сломают (seed идемпотентный).

Собрать API и сайт:

```bash
pnpm --filter @7bs/api build
pnpm --filter @7bs/web build
```

---

## Шаг 6. Файл `.htaccess` для сайта

Узнай точные пути:

```bash
which node      # путь к node
pwd             # должно быть ~/7bs ; полный путь вида /home/u/u4447042/7bs
```

Найди папку `public_html` своего сайта (в панели «Сайты» → у `USERNAME.beget.tech`
это обычно `~/USERNAME.beget.tech/public_html`). Создай в ней `.htaccess`:

```bash
nano ~/USERNAME.beget.tech/public_html/.htaccess
```

Вставь (подставь свои пути из `which node` и `pwd`):

```
PassengerNodejs /home/u/u4447042/.local/bin/node
PassengerAppType node
PassengerAppRoot /home/u/u4447042/7bs
PassengerStartupFile server.cjs
```

> `PassengerAppRoot` — это **корень проекта** (`~/7bs`), а не `public_html`.
> Точка входа `server.cjs` поднимает и API, и сайт.

В панели Beget для сайта **включи SSL** (Let's Encrypt) — чтобы работал `https://`.

---

## Шаг 7. Первый запуск

```bash
mkdir -p ~/7bs/tmp
touch ~/7bs/tmp/restart.txt
```

Подожди 30–60 секунд (первый старт долгий — поднимаются и Nest, и Next) и проверь:

- `https://USERNAME.beget.tech/api/v1/health` → `{"status":"ok",...}`
- `https://USERNAME.beget.tech` → откроется страница входа

Войди тестовым аккаунтом (мастер `mechanic@7bs.local` / `mechanic123`) и проверь
каталог, корзину, заказы.

---

## Шаг 8. Обновление при доработках

На своём ПК пушишь изменения в GitHub (ветка → merge в `main` → push).
На сервере одна команда:

```bash
cd ~/7bs
bash scripts/deploy.sh
```

Скрипт сам: заберёт изменения (`git pull`), поставит зависимости, применит
миграции БД, пересоберёт API и сайт, перезапустит приложение
(`touch tmp/restart.txt`).

---

## Тестовые аккаунты

| Роль | Логин | Пароль |
|---|---|---|
| Супер-админ | `admin@7bs.local` | `admin12345` |
| Поставщик (Инвелум) | `supplier@invelum.local` | `supplier123` |
| Мастерская | `workshop@7bs.local` | `workshop123` |
| Мастер | `mechanic@7bs.local` | `mechanic123` |

---

## Траблшутинг

**Сайт не открывается, ошибка 500.**
Смотри лог в панели Beget («Логи» сайта) или по SSH ищи логи Passenger. Частая
причина — неверный путь в `.htaccess` (проверь `which node` и `pwd`).

**`next build` падает (killed / нехватка памяти).**
На бесплатном тарифе мало RAM. Варианты:
1. Собрать сайт **локально** на ПК (`pnpm --filter @7bs/web build`) и скопировать
   папку `apps/web/.next` на сервер (через `scp -r apps/web/.next USERNAME@USERNAME.beget.tech:~/7bs/apps/web/`),
   не запуская `next build` на сервере.
2. Попросить поддержку Beget временно поднять лимит памяти.

**Картинки товаров не видны.**
Убедись, что `apps/web/.env.local` содержит `NEXT_PUBLIC_API_URL="/api/v1"` и что
сайт пересобран после создания этого файла.

**Изменил `apps/web/.env.local`, ничего не поменялось.**
Адрес API вшивается при сборке — пересобери сайт и перезапусти:
`pnpm --filter @7bs/web build && touch ~/7bs/tmp/restart.txt`.

**Перезапустить вручную:**
```bash
touch ~/7bs/tmp/restart.txt
```

**Несовместимость Node (GLIBC).** Поставь Node 20 LTS вместо 22 (шаг 2).

---

## Безопасность (после первого теста)

- Смени пароли тестовых аккаунтов и `SUPERADMIN_PASSWORD`.
- Смени креды БД Neon (пароль присылался в переписке) и обнови `apps/api/.env`.
