import { NextRequest, NextResponse } from "next/server";
import { getPublicAppUrl, getRequestBasePath, withBasePath } from "@/lib/app-url";
import {
  consumeCandidateAccessToken,
  getCandidateSessionCookieName,
  getCandidateSessionCookieOptions
} from "@/lib/auth/candidate-session";
import { isCandidateToken } from "@/lib/auth/candidate-token";

function redirectForRequest(request: NextRequest, pathAndSearch: string) {
  const basePath = getRequestBasePath(request.nextUrl.basePath);
  const target = withBasePath(pathAndSearch, basePath);
  const location =
    process.env.NODE_ENV === "production"
      ? new URL(getPublicAppUrl(pathAndSearch))
      : new URL(target, request.url);
  const response = NextResponse.redirect(location, 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, noarchive");
  return response;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const tokenValue = formData.get("token");
  const token = typeof tokenValue === "string" ? tokenValue : "";

  if (!isCandidateToken(token)) {
    return redirectForRequest(request, "/join?access=invalid");
  }

  const consumed = await consumeCandidateAccessToken(token);
  if (!consumed) {
    return redirectForRequest(request, "/join?access=invalid");
  }

  const basePath = getRequestBasePath(request.nextUrl.basePath);
  const response = redirectForRequest(request, `/candidate/${consumed.groupCode}`);
  response.cookies.set(
    getCandidateSessionCookieName(consumed.groupId),
    consumed.sessionToken,
    getCandidateSessionCookieOptions(consumed.expiresAt, basePath)
  );
  return response;
}
