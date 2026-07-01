import { AdminRole, AdminStatus, PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? "admin@example.com").trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "ChangeMe_StrongPassword_123!";
  const displayName = process.env.ADMIN_BOOTSTRAP_NAME ?? "超级管理员";

  if (password.length < 12) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.");
  }

  await prisma.admin.upsert({
    where: { email },
    update: {
      displayName,
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE
    },
    create: {
      email,
      displayName,
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      passwordHash: await hashPassword(password)
    }
  });

  console.log(`Seeded super admin: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
