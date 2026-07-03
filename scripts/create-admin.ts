import { AdminRole, AdminStatus, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

const argsSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(12),
  displayName: z.string().min(1),
  role: z.literal(AdminRole.SUPER_ADMIN).default(AdminRole.SUPER_ADMIN)
});

function parseArgs() {
  const [, , email, password, displayName, role] = process.argv;
  return argsSchema.parse({
    email,
    password,
    displayName,
    role: role ?? AdminRole.SUPER_ADMIN
  });
}

async function main() {
  const input = parseArgs();

  const admin = await prisma.admin.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      displayName: input.displayName,
      role: input.role,
      status: AdminStatus.ACTIVE
    },
    select: {
      id: true,
      email: true,
      role: true
    }
  });

  console.log(`Created admin ${admin.email} (${admin.role}) id=${admin.id}`);
}

main()
  .catch((error) => {
    console.error(
      error instanceof z.ZodError
        ? "Usage: pnpm tsx scripts/create-admin.ts email password displayName [SUPER_ADMIN]"
        : error
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
