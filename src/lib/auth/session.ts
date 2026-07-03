import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Admin } from "@prisma/client";
import { AdminRole, AdminStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const ADMIN_SESSION_COOKIE_NAME = "interview_admin_session";

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function getSessionExpiresAt(now = new Date()) {
  const ttlDays = Number.parseInt(process.env.SESSION_TTL_DAYS ?? "7", 10);
  const safeTtlDays = Number.isSafeInteger(ttlDays) && ttlDays > 0 ? ttlDays : 7;
  return new Date(now.getTime() + safeTtlDays * 24 * 60 * 60 * 1000);
}

export function shouldUseSecureAdminCookie() {
  const override = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true" || override === "1" || override === "yes") {
    return true;
  }
  if (override === "false" || override === "0" || override === "no") {
    return false;
  }

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    return appUrl.startsWith("https://");
  }

  return process.env.NODE_ENV === "production";
}

export async function createAdminSession(adminId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = getSessionExpiresAt();

  await prisma.adminSession.create({
    data: {
      adminId,
      tokenHash: hashSessionToken(token),
      expiresAt
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureAdminCookie(),
    path: "/",
    expires: expiresAt
  });
}

export async function getCurrentAdmin(): Promise<Admin | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.adminSession.findUnique({
    where: {
      tokenHash: hashSessionToken(token)
    },
    include: {
      admin: true
    }
  });

  if (
    !session ||
    session.expiresAt.getTime() <= Date.now() ||
    session.admin.status !== AdminStatus.ACTIVE ||
    session.admin.role !== AdminRole.SUPER_ADMIN
  ) {
    return null;
  }

  return session.admin;
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  return admin;
}

export async function destroyCurrentAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.adminSession.deleteMany({
      where: {
        tokenHash: hashSessionToken(token)
      }
    });
  }

  cookieStore.delete(ADMIN_SESSION_COOKIE_NAME);
}
