// Bootstrap: супер-админ + генеральный поставщик «Инвелум» с шаблоном импорта.
// CommonJS, чтобы запускаться node-ом напрямую без ts-node.
const { PrismaClient, UserRole, TenantType } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// Маппинг колонок прайса Инвелум (лист "Прайс", шапка в строке 5).
// Числа — индексы колонок (1-based); строки — мета (currency).
const INVELUM_MAPPING = {
  groupCode: 1,
  sku: 2,
  name: 4,
  description: 6,
  pack: 7,
  unit: 8,
  price: 9,
  stock: 12,
  country: 14,
  barcode: 15,
  currency: "BYN",
  // управляющие ключи (с "_"): колонки заголовков категорий
  _categoryCol: 3,
  _subcategoryCol: 4,
};

async function main() {
  // 1. Супер-админ
  const email = process.env.SUPERADMIN_EMAIL || "admin@7bs.local";
  const password = process.env.SUPERADMIN_PASSWORD || "admin12345";
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Super Admin",
      passwordHash: await bcrypt.hash(password, 10),
      role: UserRole.SUPER_ADMIN,
      tenantId: null,
    },
  });
  console.log(`Super admin: ${admin.email}`);

  // 2. Поставщик «Инвелум»
  let invelum = await prisma.tenant.findFirst({
    where: { type: TenantType.SUPPLIER, name: "ООО «Инвелум»" },
  });
  if (!invelum) {
    invelum = await prisma.tenant.create({
      data: { type: TenantType.SUPPLIER, name: "ООО «Инвелум»" },
    });
  }
  console.log(`Supplier: ${invelum.name} (id=${invelum.id})`);

  // 3. Админ поставщика
  const supplierUser = await prisma.user.upsert({
    where: { email: "supplier@invelum.local" },
    update: {},
    create: {
      email: "supplier@invelum.local",
      name: "Invelum Admin",
      passwordHash: await bcrypt.hash("supplier123", 10),
      role: UserRole.SUPPLIER_ADMIN,
      tenantId: invelum.id,
    },
  });
  console.log(`Supplier admin: ${supplierUser.email}`);

  // 4. Шаблон импорта
  const existingTemplate = await prisma.importTemplate.findFirst({
    where: { supplierId: invelum.id },
  });
  if (!existingTemplate) {
    const t = await prisma.importTemplate.create({
      data: {
        supplierId: invelum.id,
        name: "Invelum — Прайс",
        sheetName: "Прайс",
        headerRow: 5,
        columnMapping: INVELUM_MAPPING,
      },
    });
    console.log(`Import template created: ${t.name}`);
  } else {
    // Обновляем маппинг (могли добавиться новые ключи, напр. категории).
    await prisma.importTemplate.update({
      where: { id: existingTemplate.id },
      data: { columnMapping: INVELUM_MAPPING },
    });
    console.log(`Import template updated: ${existingTemplate.name}`);
  }

  // 5. Тестовая мастерская
  let workshop = await prisma.tenant.findFirst({
    where: { type: TenantType.WORKSHOP, name: "Веломастерская №1" },
  });
  if (!workshop) {
    workshop = await prisma.tenant.create({
      data: { type: TenantType.WORKSHOP, name: "Веломастерская №1" },
    });
  }
  console.log(`Workshop: ${workshop.name} (id=${workshop.id})`);

  // 6. Админ мастерской + мастер
  await prisma.user.upsert({
    where: { email: "workshop@7bs.local" },
    update: {},
    create: {
      email: "workshop@7bs.local",
      name: "Workshop Admin",
      passwordHash: await bcrypt.hash("workshop123", 10),
      role: UserRole.WORKSHOP_ADMIN,
      tenantId: workshop.id,
    },
  });
  await prisma.user.upsert({
    where: { email: "mechanic@7bs.local" },
    update: {},
    create: {
      email: "mechanic@7bs.local",
      name: "Механик",
      passwordHash: await bcrypt.hash("mechanic123", 10),
      role: UserRole.MECHANIC,
      tenantId: workshop.id,
    },
  });
  console.log("Workshop admin: workshop@7bs.local / Mechanic: mechanic@7bs.local");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
