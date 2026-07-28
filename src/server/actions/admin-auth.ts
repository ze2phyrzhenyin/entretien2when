"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AdminStatus, AuditActorType } from "@prisma/client";
import { createAdminSession, destroyCurrentAdminSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import {
  assertRateLimit,
  createRateLimitKey,
  getTrustedClientIp,
  RateLimitError
} from "@/lib/rate-limit";
import { adminLoginSchema } from "@/lib/validation/admin-auth";

export type AdminLoginState = {
  error?: string;
};

const DUMMY_ADMIN_PASSWORD_HASH =
  "scrypt$64$AcpIIOe2t6NqPQqlOq2mjw$X7WrUX2W00kWftPfPEEjUgZ6eomPIpXwYkvjGRY9LeDZHlHQmViNoohXgnCT5r4kVycWbdS674Un49RPGUdK0g";

async function assertAdminLoginRateLimit(email: string, clientIp: string | null) {
  await assertRateLimit({
    key: "admin-login-global",
    limit: 120,
    windowMs: 60_000
  });
  if (clientIp) {
    await assertRateLimit({
      key: createRateLimitKey("admin-login-ip", clientIp),
      limit: 20,
      windowMs: 15 * 60 * 1000
    });
  }
  await assertRateLimit({
    key: createRateLimitKey("admin-login-identity", email),
    limit: 8,
    windowMs: 15 * 60 * 1000
  });
}

export async function adminLoginAction(
  _previousState: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "请检查登录信息" };
  }

  const requestHeaders = await headers();
  const clientIp = getTrustedClientIp(requestHeaders);
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 300) || null;

  try {
    await assertAdminLoginRateLimit(parsed.data.email, clientIp);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { error: error.message };
    }
    throw error;
  }

  const admin = await prisma.admin.findUnique({
    where: {
      email: parsed.data.email
    }
  });

  // Always perform the same expensive verification even when the identity
  // does not exist or is disabled, avoiding a timing-based account oracle.
  const passwordMatches = await verifyPassword(
    parsed.data.password,
    admin?.passwordHash ?? DUMMY_ADMIN_PASSWORD_HASH
  );
  if (!admin || admin.status !== AdminStatus.ACTIVE || !passwordMatches) {
    await prisma.auditLog.create({
      data: {
        actorType: AuditActorType.SYSTEM,
        action: "system.admin_login_failed",
        entityType: "AdminLogin",
        entityId: createRateLimitKey("admin-login-audit", parsed.data.email),
        ipAddress: clientIp,
        userAgent,
        afterData: {
          reason: admin?.status === AdminStatus.DISABLED ? "disabled_or_invalid" : "invalid"
        }
      }
    });
    return { error: "邮箱或密码不正确" };
  }

  await createAdminSession(admin.id);
  await prisma.$transaction([
    prisma.admin.update({
      where: {
        id: admin.id
      },
      data: {
        lastLoginAt: new Date()
      }
    }),
    prisma.auditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        actorAdminId: admin.id,
        action: "admin.login",
        entityType: "Admin",
        entityId: admin.id,
        ipAddress: clientIp,
        userAgent
      }
    })
  ]);

  redirect("/admin");
}

export async function adminLogoutAction() {
  await destroyCurrentAdminSession();
  redirect("/admin/login");
}
