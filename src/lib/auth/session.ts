import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Admin } from "@prisma/client";
import { AdminStatus } from "@prisma/client";
import { getSessionCookiePath } from "@/lib/app-url";
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
  if (process.env.NODE_ENV === "production") {
    // A production deployment without HTTPS is a configuration error. Sending
    // an authentication cookie over HTTP is never an acceptable fallback.
    return true;
  }

  const override = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true" || override === "1" || override === "yes") {
    return true;
  }

  return false;
}

export function getAdminSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureAdminCookie(),
    path: getSessionCookiePath(),
    expires: expiresAt
  };
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
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, token, getAdminSessionCookieOptions(expiresAt));
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
    session.admin.status !== AdminStatus.ACTIVE
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

  // The path must match the original Set-Cookie path, otherwise a scoped
  // production cookie survives logout.
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, "", {
    ...getAdminSessionCookieOptions(new Date(0)),
    maxAge: 0
  });
}
