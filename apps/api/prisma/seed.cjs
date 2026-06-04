// Bootstrap первого супер-админа. CommonJS, чтобы запускаться node-ом напрямую
// без ts-node/транспиляции и без ESM/CJS-интероп проблем.
const { PrismaClient, UserRole } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPERADMIN_EMAIL || "admin@7bs.local";
  const password = process.env.SUPERADMIN_PASSWORD || "admin12345";

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Super Admin",
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      tenantId: null,
    },
  });

  console.log(`Super admin ready: ${admin.email} (id=${admin.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
