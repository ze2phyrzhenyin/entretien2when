import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

const inputSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(12, "ADMIN_ROTATE_PASSWORD must be at least 12 characters.")
});

async function main() {
  const [, , email, confirmation] = process.argv;
  if (confirmation !== "--confirm") {
    throw new Error(
      "Usage: ADMIN_ROTATE_PASSWORD='<new-password>' pnpm tsx scripts/reset-admin-password.ts admin@example.com --confirm"
    );
  }

  const input = inputSchema.parse({ email, password: process.env.ADMIN_ROTATE_PASSWORD });
  const passwordHash = await hashPassword(input.password);

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.admin.updateMany({
      where: { email: input.email },
      data: { passwordHash }
    });

    if (updated.count !== 1) {
      throw new Error("No administrator was updated for that email address.");
    }

    const sessions = await tx.adminSession.deleteMany({
      where: { admin: { email: input.email } }
    });
    return { revokedSessions: sessions.count };
  });

  console.log(JSON.stringify({ email: input.email, ...result }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
