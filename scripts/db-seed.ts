import { AdminRole, AdminStatus, PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const isProduction = process.env.NODE_ENV === "production";
  const configuredEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();
  const configuredPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (isProduction && (!configuredEmail || !configuredPassword)) {
    throw new Error(
      "ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be explicitly configured in production."
    );
  }

  const email = (configuredEmail ?? "admin@example.com").toLowerCase();
  const password = configuredPassword ?? "ChangeMe_StrongPassword_123!";
  const displayName = process.env.ADMIN_BOOTSTRAP_NAME?.trim() || "超级管理员";

  if (password.length < 12) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.");
  }

  const existing = await prisma.admin.findUnique({
    where: { email },
    select: { id: true }
  });

  if (existing) {
    console.log(`Bootstrap admin already exists; no changes were made: ${email}`);
    return;
  }

  if (isProduction && (await prisma.admin.count()) > 0) {
    throw new Error(
      "Refusing to create a bootstrap super admin because this production database already has administrators."
    );
  }

  const passwordHash = await hashPassword(password);

  await prisma.admin.create({
    data: {
      email,
      displayName,
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      passwordHash
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
