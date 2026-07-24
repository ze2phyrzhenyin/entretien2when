import "dotenv/config";
import { expect, test } from "@playwright/test";
import { AdminRole, AdminStatus, InterviewGroupStatus, PrismaClient } from "@prisma/client";
import { generateCandidateToken, hashCandidateToken } from "../../src/lib/auth/candidate-token";
import { hashPassword } from "../../src/lib/auth/password";

const prisma = new PrismaClient();
const adminEmail = "e2e-candidate-auth-security@example.com";
const groupNamePrefix = "E2E 候选人认证安全 ";

function uniqueSuffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

async function createOpenGroup(adminId: string) {
  const suffix = uniqueSuffix();
  return prisma.interviewGroup.create({
    data: {
      name: `${groupNamePrefix}${suffix}`,
      groupCode: `AUTH-${suffix}`,
      status: InterviewGroupStatus.OPEN,
      createdByAdminId: adminId
    },
    select: { id: true, groupCode: true }
  });
}

async function createAccessToken(groupId: string) {
  const token = generateCandidateToken();
  const email = `candidate-${uniqueSuffix().toLowerCase()}@example.com`;
  const accessToken = await prisma.candidateAccessToken.create({
    data: {
      groupId,
      tokenHash: hashCandidateToken(token),
      name: "认证测试候选人",
      email,
      normalizedEmail: email,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    },
    select: { id: true }
  });

  return { token, accessTokenId: accessToken.id };
}

test.describe("candidate magic-link security", () => {
  test.describe.configure({ mode: "serial" });
  let adminId: string;

  test.beforeAll(async () => {
    const admin = await prisma.admin.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash: await hashPassword("E2E_Candidate_Auth_Security_123!"),
        displayName: "E2E 候选人认证安全管理员",
        role: AdminRole.SUPER_ADMIN,
        status: AdminStatus.ACTIVE
      },
      create: {
        email: adminEmail,
        passwordHash: await hashPassword("E2E_Candidate_Auth_Security_123!"),
        displayName: "E2E 候选人认证安全管理员",
        role: AdminRole.SUPER_ADMIN,
        status: AdminStatus.ACTIVE
      },
      select: { id: true }
    });
    adminId = admin.id;
  });

  test.afterAll(async () => {
    await prisma.interviewGroup.deleteMany({
      where: { name: { startsWith: groupNamePrefix } }
    });
    await prisma.$disconnect();
  });

  test("GET is a non-consuming preview and concurrent POSTs claim one session only", async ({
    request
  }) => {
    const group = await createOpenGroup(adminId);
    const { token, accessTokenId } = await createAccessToken(group.id);

    const preview = await request.get(`/candidate/auth/${token}`, { maxRedirects: 0 });
    expect(preview.status()).toBe(302);
    expect(preview.headers()["location"]).toContain(`/candidate/auth/confirm/${token}`);
    await expect
      .poll(() =>
        prisma.candidateAccessToken.findUnique({
          where: { id: accessTokenId },
          select: { consumedAt: true }
        })
      )
      .toMatchObject({ consumedAt: null });

    const attempts = await Promise.all(
      Array.from({ length: 12 }, () =>
        request.post(`/candidate/auth/${token}`, { maxRedirects: 0 })
      )
    );
    const successfulAttempts = attempts.filter((response) =>
      response.headers()["location"]?.includes(`/candidate/${group.groupCode}`)
    );

    expect(successfulAttempts).toHaveLength(1);
    expect(successfulAttempts[0]?.status()).toBe(303);
    await expect
      .poll(() =>
        prisma.candidateSession.count({
          where: { groupId: group.id }
        })
      )
      .toBe(1);
    await expect
      .poll(() =>
        prisma.candidateAccessToken.findUnique({
          where: { id: accessTokenId },
          select: { consumedAt: true }
        })
      )
      .toMatchObject({ consumedAt: expect.any(Date) });
  });

  test("a closed group rejects a link without consuming it or creating a session", async ({
    request
  }) => {
    const group = await createOpenGroup(adminId);
    const { token, accessTokenId } = await createAccessToken(group.id);
    await prisma.interviewGroup.update({
      where: { id: group.id },
      data: { status: InterviewGroupStatus.CLOSED }
    });

    const response = await request.post(`/candidate/auth/${token}`, { maxRedirects: 0 });
    expect(response.status()).toBe(303);
    expect(response.headers()["location"]).toContain("/join?access=invalid");
    await expect
      .poll(() =>
        prisma.candidateAccessToken.findUnique({
          where: { id: accessTokenId },
          select: { consumedAt: true }
        })
      )
      .toMatchObject({ consumedAt: null });
    await expect
      .poll(() =>
        prisma.candidateSession.count({
          where: { groupId: group.id }
        })
      )
      .toBe(0);
  });
});
