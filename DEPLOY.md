# Развёртывание 7BS на хостинге Beget

Пошаговая инструкция «с нуля»: как залить проект с GitHub на виртуальный хостинг
Beget и как потом обновлять его по мере доработок.

> **Что мы разворачиваем.** Два Node-приложения + внешняя БД:
> - **API** (NestJS) — на поддомене `api.ВАШ-ДОМЕН`
> - **Сайт** (Next.js) — на основном домене `ВАШ-ДОМЕН`
> - **База данных** — уже на **Neon** (облачный Postgres), её разворачивать не нужно
> - Картинки товаров хранятся на диске сервера (`apps/api/uploads`) и переживают обновления
>
> На Beget Node-приложения запускаются через **Passenger**: каждое приложение —
> отдельный «сайт» с файлом `.htaccess`, который указывает на точку входа.

---

## Обозначения

В командах ниже заменяй плейсхолдеры на свои значения:
- `USERNAME` — твой логин на Beget (например `mylogin`)
- `HOME` — домашняя папка, узнаешь командой `echo $HOME` (вид `/home/m/mylogin`)
- `ВАШ-ДОМЕН` — домен сайта (на бесплатном тарифе это технический `USERNAME.beget.tech`)

---

## Шаг 1. Поддомен для API

В панели Beget:
1. **Домены** → у своего домена создай поддомен **`api`** (получится `api.ВАШ-ДОМЕН`).
2. **Сайты** → убедись, что есть два сайта:
   - сайт на `ВАШ-ДОМЕН` (это будет фронт),
   - сайт на `api.ВАШ-ДОМЕН` (это будет API).
3. Для обоих сайтов в панели **включи SSL** (Let's Encrypt) — чтобы работал `https://`.

Запомни пути к их папкам `public_html` (обычно `~/ВАШ-ДОМЕН/public_html` и
`~/api.ВАШ-ДОМЕН/public_html`).

---

## Шаг 2. Подключение по SSH

Данные SSH — в панели Beget (раздел «SSH»). Подключайся из PowerShell:

```powershell
ssh USERNAME@USERNAME.beget.tech
```

Введи пароль. Ты в домашней папке. Проверь путь:

```bash
echo $HOME
```

---

## Шаг 3. Установка Node.js и pnpm

Beget не даёт нужную версию Node глобально — ставим свою в `~/.local`.

```bash
mkdir -p ~/.local && cd ~/.local
# Node.js 22 LTS (Linux x64). Если будет ошибка совместимости — попробуй 20 LTS.
wget https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz
tar xf node-v22.14.0-linux-x64.tar.xz --strip 1
rm node-v22.14.0-linux-x64.tar.xz
```

Добавь Node в PATH (чтобы команды `node`/`npm` работали всегда):

```bash
echo 'export PATH=$HOME/.local/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
node -v    # должно показать v22.x
```

Установи pnpm:

```bash
npm install -g pnpm
pnpm -v
```

Запомни абсолютный путь к node — он понадобится в `.htaccess`:

```bash
which node     # например /home/m/mylogin/.local/bin/node
```

---

## Шаг 4. Клонирование проекта с GitHub

```bash
cd ~
git clone https://github.com/Adasiq/7BikesService.git 7bs
cd 7bs
```

> Репозиторий приватный? Тогда сгенерируй на сервере SSH-ключ
> (`ssh-keygen -t ed25519`), добавь `~/.ssh/id_ed25519.pub` в GitHub →
> Settings → Deploy keys, и клонируй по SSH:
> `git clone git@github.com:Adasiq/7BikesService.git 7bs`.

---

## Шаг 5. Переменные окружения

### API — файл `apps/api/.env`

```bash
nano apps/api/.env
```

Вставь (подставь свои значения; `DATABASE_URL` — из панели Neon):

```
DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"
JWT_ACCESS_SECRET="придумай-длинную-случайную-строку-1"
JWT_REFRESH_SECRET="придумай-длинную-случайную-строку-2"
SUPERADMIN_EMAIL="admin@7bs.local"
SUPERADMIN_PASSWORD="смени-на-надёжный"
```

Сохрани: `Ctrl+O`, `Enter`, `Ctrl+X`.

### Сайт — файл `apps/web/.env.local`

Важно: адрес API «вшивается» в сайт **на этапе сборки**, поэтому файл нужен
**до** сборки.

```bash
nano apps/web/.env.local
```

```
NEXT_PUBLIC_API_URL="https://api.ВАШ-ДОМЕН/api/v1"
```

Сохрани и закрой.

> Оба файла в `.gitignore` — в репозиторий не попадут, это нормально.

---

## Шаг 6. Установка зависимостей и сборка

```bash
cd ~/7bs
pnpm install
pnpm build:shared
```

> Если pnpm ругается на ключ `allowBuilds` в `pnpm-workspace.yaml` — это
> безопасно, можно проигнорировать (он нужен только в среде разработки).

Применить миграции БД (создаст таблицы в Neon, если их ещё нет):

```bash
pnpm --filter @7bs/api exec prisma migrate deploy
```

Создать стартовые данные (супер-админ, тестовые поставщик/мастерская):

```bash
pnpm --filter @7bs/api exec prisma db seed
```

> Если ты тестировал локально на **той же** базе Neon — таблицы и данные уже
> есть, миграция и seed просто ничего не сломают (seed идемпотентный).

Собрать оба приложения:

```bash
pnpm --filter @7bs/api build
pnpm --filter @7bs/web build
```

---

## Шаг 7. Точки входа Passenger (уже в проекте)

Ничего создавать не нужно — в репозитории уже есть:
- API: точка входа `apps/api/dist/main.js` (после сборки)
- Сайт: точка входа `apps/web/server.cjs`

Создай папки для перезапуска:

```bash
mkdir -p ~/7bs/apps/api/tmp ~/7bs/apps/web/tmp
```

---

## Шаг 8. Файлы `.htaccess` для двух сайтов

Подставь свой путь к node (из `which node`, шаг 3) и свой `HOME`.

### API — `.htaccess` в папке сайта `api.ВАШ-ДОМЕН/public_html`

```bash
nano ~/api.ВАШ-ДОМЕН/public_html/.htaccess
```

```
PassengerNodejs /home/m/mylogin/.local/bin/node
PassengerAppType node
PassengerAppRoot /home/m/mylogin/7bs/apps/api
PassengerStartupFile dist/main.js
```

### Сайт — `.htaccess` в папке сайта `ВАШ-ДОМЕН/public_html`

```bash
nano ~/ВАШ-ДОМЕН/public_html/.htaccess
```

```
PassengerNodejs /home/m/mylogin/.local/bin/node
PassengerAppType node
PassengerAppRoot /home/m/mylogin/7bs/apps/web
PassengerStartupFile server.cjs
```

> `PassengerAppRoot` — это папка приложения внутри проекта, а не `public_html`.
> Passenger сам будет отдавать все запросы Node-приложению.

---

## Шаг 9. Первый запуск

Перезапусти оба приложения (Passenger перечитает конфиг):

```bash
touch ~/7bs/apps/api/tmp/restart.txt
touch ~/7bs/apps/web/tmp/restart.txt
```

Подожди 20–40 секунд (первый старт дольше) и проверь:

- `https://api.ВАШ-ДОМЕН/api/v1/health` → должно вернуть `{"status":"ok",...}`
- `https://ВАШ-ДОМЕН` → откроется страница входа

Войди под тестовым аккаунтом (например мастер `mechanic@7bs.local` /
`mechanic123`) и проверь каталог, корзину, заказы.

---

## Шаг 10. Обновление при доработках

Дальше цикл простой. На своём ПК ты пушишь изменения в GitHub
(как обычно: ветка → merge в `main` → push). На сервере:

```bash
cd ~/7bs
bash scripts/deploy.sh
```

Скрипт сам: заберёт изменения (`git pull`), поставит зависимости, применит
миграции, пересоберёт API и сайт, перезапустит оба приложения.

> Если в обновлении менялась схема БД — `deploy.sh` сам применит новую миграцию
> (`prisma migrate deploy`).

---

## Траблшутинг

**Сайт/API не открывается, ошибка 500.**
Смотри лог Passenger конкретного сайта:
```bash
tail -n 50 ~/api.ВАШ-ДОМЕН/public_html/../logs/*error* 2>/dev/null
# или в панели Beget: раздел «Логи» нужного сайта
```

**`next build` падает с нехваткой памяти (killed).**
На бесплатном тарифе мало RAM. Варианты:
1. Собери сайт **локально** на своём ПК (`pnpm --filter @7bs/web build`), затем
   скопируй папку `apps/web/.next` на сервер (например через `scp -r`), и не
   запускай `next build` на сервере.
2. Либо обратись в поддержку Beget за временным увеличением лимита.

**Картинки товаров не отображаются.**
Проверь, что `NEXT_PUBLIC_API_URL` в `apps/web/.env.local` указан с `https://` и
что сайт пересобран после изменения этого файла. Картинки отдаёт API по адресу
`https://api.ВАШ-ДОМЕН/uploads/...`.

**Меняешь `apps/web/.env.local` — изменения не видны.**
Адрес API вшивается при сборке. После правки `.env.local` пересобери сайт:
`pnpm --filter @7bs/web build` и `touch apps/web/tmp/restart.txt`.

**Ошибка совместимости Node (GLIBC).**
Поставь Node 20 LTS вместо 22 (шаг 3, заменив версию в ссылке).

**Перезапустить вручную:**
```bash
touch ~/7bs/apps/api/tmp/restart.txt ~/7bs/apps/web/tmp/restart.txt
```

---

## Безопасность (после первого теста)

- Смени пароли тестовых аккаунтов и `SUPERADMIN_PASSWORD`.
- Смени креды БД Neon (пароль присылался в переписке) и обнови `apps/api/.env`.
- Позже стоит ограничить CORS в API только своим доменом (сейчас разрешены все).
