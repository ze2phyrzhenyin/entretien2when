import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  AdminGroupRole,
  AdminRole,
  AdminStatus,
  CandidateStatus,
  InterviewGroupStatus
} from "@prisma/client";
import { generateGroupCode } from "@/lib/group-code/generate";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";

const prefix = "E2E 成员权限 ";
const superEmail = "role-super-e2e@example.test";
const ownerEmail = "role-owner-e2e@example.test";

async function sessionToken(adminId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.adminSession.create({
    data: {
      adminId,
      tokenHash: createHash("sha256").update(token).digest("base64url"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }
  });
  return token;
}

test.afterAll(async () => {
  await prisma.interviewGroup.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.admin.deleteMany({ where: { email: { in: [superEmail, ownerEmail] } } });
  await prisma.$disconnect();
});

test("last OWNER is protected, replacement OWNER can be added, and cross-group export is denied", async ({
  browser
}) => {
  test.setTimeout(60_000);
  const runId = Date.now().toString(36);
  const [superAdmin, ownerAdmin] = await Promise.all([
    prisma.admin.upsert({
      where: { email: superEmail },
      update: { role: AdminRole.SUPER_ADMIN, status: AdminStatus.ACTIVE },
      create: {
        email: superEmail,
        passwordHash: await hashPassword("Role_Super_E2E_123!"),
        displayName: "权限测试超级管理员",
        role: AdminRole.SUPER_ADMIN,
        status: AdminStatus.ACTIVE
      }
    }),
    prisma.admin.upsert({
      where: { email: ownerEmail },
      update: { role: AdminRole.ADMIN, status: AdminStatus.ACTIVE },
      create: {
        email: ownerEmail,
        passwordHash: await hashPassword("Role_Owner_E2E_123!"),
        displayName: "权限测试 OWNER",
        role: AdminRole.ADMIN,
        status: AdminStatus.ACTIVE
      }
    })
  ]);
  const [ownedGroup, forbiddenGroup] = await Promise.all([
    prisma.interviewGroup.create({
      data: {
        name: `${prefix}OWNER ${runId}`,
        groupCode: generateGroupCode(),
        status: InterviewGroupStatus.OPEN,
        createdByAdminId: superAdmin.id,
        adminMemberships: {
          create: { adminId: ownerAdmin.id, role: AdminGroupRole.OWNER }
        }
      }
    }),
    prisma.interviewGroup.create({
      data: {
        name: `${prefix}隔离 ${runId}`,
        groupCode: generateGroupCode(),
        status: InterviewGroupStatus.OPEN,
        createdByAdminId: superAdmin.id,
        adminMemberships: {
          create: { adminId: superAdmin.id, role: AdminGroupRole.OWNER }
        }
      }
    })
  ]);
  const forbiddenCandidate = await prisma.candidate.create({
    data: {
      groupId: forbiddenGroup.id,
      name: "隔离候选人",
      email: `isolated-${runId}@example.test`,
      normalizedEmail: `isolated-${runId}@example.test`,
      status: CandidateStatus.SUBMITTED
    }
  });

  const superContext = await browser.newContext();
  const ownerContext = await browser.newContext();
  try {
    await Promise.all([
      superContext.addCookies([
        {
          name: "interview_admin_session",
          value: await sessionToken(superAdmin.id),
          url: "http://localhost:3101",
          httpOnly: true,
          sameSite: "Lax"
        }
      ]),
      ownerContext.addCookies([
        {
          name: "interview_admin_session",
          value: await sessionToken(ownerAdmin.id),
          url: "http://localhost:3101",
          httpOnly: true,
          sameSite: "Lax"
        }
      ])
    ]);

    const page = await superContext.newPage();
    await page.goto(`/admin/groups/${ownedGroup.id}/members`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "撤权" }).click();
    await expect(page.getByText("不能撤销或降级最后一个有效 OWNER。")).toBeVisible();

    await page.getByLabel("管理员", { exact: true }).selectOption(superAdmin.id);
    await page.getByLabel("组角色", { exact: true }).selectOption(AdminGroupRole.OWNER);
    await page.getByRole("button", { name: "添加成员" }).click();
    await expect(page.getByText("成员角色已保存并写入审计日志。")).toBeVisible();

    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(`/admin/groups/${ownedGroup.id}/members`);
    await expect(ownerPage.getByRole("heading", { name: /成员与角色/ })).toBeVisible();
    const denied = await ownerContext.request.get(
      `/admin/groups/${forbiddenGroup.id}/candidates/${forbiddenCandidate.id}/export`
    );
    expect(denied.status()).toBe(403);
  } finally {
    await superContext.close();
    await ownerContext.close();
  }

  await expect(
    prisma.auditLog.count({
      where: {
        groupId: ownedGroup.id,
        action: "admin.create_group_membership",
        actorAdminId: superAdmin.id
      }
    })
  ).resolves.toBe(1);
});
