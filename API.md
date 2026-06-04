# 7BS — Контракты API (черновик)

Спецификация REST API по модулям. Дизайн-артефакт перед кодом. Связан с моделью в [`prisma/schema.draft.prisma`](prisma/schema.draft.prisma).

## Общие конвенции

- **База:** `/api/v1`
- **Авторизация:** `Authorization: Bearer <accessToken>` (JWT). Токен несёт `userId`, `tenantId`, `role`.
- **Тенант-скоуп:** автоматически из токена (Prisma middleware), клиент не передаёт `tenantId`/`workshopId`/`supplierId` в теле — он берётся из контекста. `SUPER_ADMIN` — исключение, работает по всем тенантам.
- **Пагинация:** `?page=1&limit=20` → ответ `{ data: [...], total, page, limit }`.
- **Формат ошибки:** `{ statusCode, message, error }` (стандарт NestJS).
- **Роли** в таблицах: `SA`=SUPER_ADMIN, `SuA`=SUPPLIER_ADMIN, `SuS`=SUPPLIER_STAFF, `WA`=WORKSHOP_ADMIN, `M`=MECHANIC.

---

## 1. Auth (модуль identity)

| Метод | Путь | Доступ | Тело / ответ |
|---|---|---|---|
| POST | `/auth/login` | публично | `{ email, password }` → `{ accessToken, refreshToken, user }` |
| POST | `/auth/refresh` | публично | `{ refreshToken }` → `{ accessToken }` |
| POST | `/auth/logout` | любой | — |
| GET | `/auth/me` | любой | → `{ id, email, name, role, tenant }` |

---

## 2. Tenants (управление площадкой)

| Метод | Путь | Доступ | Тело / ответ |
|---|---|---|---|
| GET | `/tenants` | SA | `?type=workshop\|supplier` → список тенантов |
| POST | `/tenants` | SA | `{ type, name }` → Tenant |
| GET | `/tenants/:id` | SA | → Tenant |
| PATCH | `/tenants/:id` | SA | `{ name? }` |
| POST | `/tenants/:id/admins` | SA | `{ email, name, password }` → создаёт админа тенанта (роль зависит от типа: SUPPLIER_ADMIN / WORKSHOP_ADMIN) |

---

## 3. Users (сотрудники тенанта)

Скоуп — текущий тенант. Админ заводит сотрудников своего тенанта.

| Метод | Путь | Доступ | Тело / ответ |
|---|---|---|---|
| GET | `/users` | SuA, WA | список пользователей своего тенанта |
| POST | `/users` | SuA, WA | `{ email, name, password, role }` (role ограничена типом тенанта: SUPPLIER_STAFF / MECHANIC) |
| PATCH | `/users/:id` | SuA, WA | `{ name?, isActive? }` |
| DELETE | `/users/:id` | SuA, WA | деактивация (soft) |

---

## 4. Import (прайсы поставщика)

Доступ: сторона поставщика. В MVP — один шаблон генерального поставщика.

| Метод | Путь | Доступ | Тело / ответ |
|---|---|---|---|
| GET | `/import/templates` | SuA, SuS | список ImportTemplate своего поставщика |
| POST | `/import/templates` | SuA | `{ name, sheetName?, headerRow?, columnMapping }` |
| PATCH | `/import/templates/:id` | SuA | частичное обновление |
| POST | `/import/batches` | SuA, SuS | `multipart: file, templateId` → парсит синхронно → `{ batchId, status, rowsOk, rowsErr, errorLog }` |
| GET | `/import/batches` | SuA, SuS | история загрузок |
| GET | `/import/batches/:id` | SuA, SuS | детали партии + ошибки |

---

## 5. Catalog (каталог товаров)

| Метод | Путь | Доступ | Тело / ответ |
|---|---|---|---|
| GET | `/catalog/products` | M, WA (по всем поставщикам); SuA, SuS (только свои) | `?search=&supplierId=&page=` → список Product |
| GET | `/catalog/products/:id` | M, WA, SuA, SuS | → Product |

NOTE: для мастерской поиск идёт по всем активным товарам всех поставщиков; для поставщика — фильтр на свой `supplierId` принудительно.

---

## 6. CRM (клиенты / велосипеды / заказ-наряды)

Скоуп — текущая мастерская. Доступ: WA, M.

| Метод | Путь | Тело / ответ |
|---|---|---|
| GET / POST | `/clients` | список / `{ name, phone?, email?, notes? }` |
| GET / PATCH | `/clients/:id` | детали / обновление |
| GET / POST | `/clients/:id/bikes` | велосипеды клиента / `{ brand?, model?, notes? }` |
| GET / POST | `/work-orders` | список / `{ clientId, bikeId?, title?, description? }` |
| GET / PATCH | `/work-orders/:id` | детали (с lines и привязанными orderItems) / обновление |
| PATCH | `/work-orders/:id/status` | `{ status }` — переход по статус-машине (NEW→IN_PROGRESS→WAITING_PARTS→DONE→CLOSED) |
| POST | `/work-orders/:id/lines` | `{ description, qty?, price? }` |
| DELETE | `/work-orders/:id/lines/:lineId` | — |

---

## 7. Orders (заказ мастерской поставщику)

| Метод | Путь | Доступ | Тело / ответ |
|---|---|---|---|
| POST | `/orders/checkout` | M, WA | `{ items: [{ productId, qty, workOrderId? }] }` → **бьёт корзину по поставщикам**, создаёт N заказов со snapshot-полями → `{ orders: [...] }` |
| GET | `/orders` | M, WA (свои размещённые); SuA, SuS (свои входящие) | `?status=` → список |
| GET | `/orders/:id` | стороны заказа | → Order + items |
| PATCH | `/orders/:id/status` | SuA, SuS | `{ status }` — поставщик ведёт по статус-машине (NEW→ACCEPTED→ASSEMBLED→SHIPPED / CANCELLED) |

NOTE: уведомление о новом заказе в MVP — только появление в списке входящих у поставщика (e-mail отложен).

---

## Сводка прав по ролям

| Область | SA | SuA | SuS | WA | M |
|---|:--:|:--:|:--:|:--:|:--:|
| Тенанты | ✅ | | | | |
| Сотрудники тенанта | | ✅ | | ✅ | |
| Шаблоны/импорт прайса | | ✅ | ✅ | | |
| Свой каталог | | ✅ | ✅ | | |
| Поиск по всему каталогу | | | | ✅ | ✅ |
| Клиенты/велосипеды/наряды | | | | ✅ | ✅ |
| Оформление заказа | | | | ✅ | ✅ |
| Обработка входящих заказов | | ✅ | ✅ | | |
