import "dotenv/config";
import { AdminGroupRole, PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const argsSchema = z.object({
  adminEmail: z
    .string()
    .email()
    .transform((value) => value.toLowerCase()),
  groupRef: z.string().min(1),
  role: z.nativeEnum(AdminGroupRole).default(AdminGroupRole.VIEWER)
});

function parseArgs() {
  const [, , adminEmail, groupRef, role] = process.argv;
  return argsSchema.parse({
    adminEmail,
    groupRef,
    role: role ?? AdminGroupRole.VIEWER
  });
}

async function main() {
  const input = parseArgs();
  const [admin, group] = await Promise.all([
    prisma.admin.findUniqueOrThrow({
      where: { email: input.adminEmail },
      select: { id: true, email: true }
    }),
    prisma.interviewGroup.findFirstOrThrow({
      where: {
        OR: [{ id: input.groupRef }, { groupCode: input.groupRef }]
      },
      select: { id: true, name: true, groupCode: true }
    })
  ]);

  const membership = await prisma.adminGroupMembership.upsert({
    where: {
      adminId_groupId: {
        adminId: admin.id,
        groupId: group.id
      }
    },
    update: { role: input.role },
    create: {
      adminId: admin.id,
      groupId: group.id,
      role: input.role
    }
  });

  console.log(
    `Assigned ${admin.email} to ${group.name} (${group.groupCode}) as ${membership.role}`
  );
}

main()
  .catch((error) => {
    console.error(
      error instanceof z.ZodError
        ? "Usage: pnpm tsx scripts/assign-admin-group.ts admin@example.com <groupId|groupCode> [OWNER|SCHEDULER|REVIEWER|VIEWER]"
        : error
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
