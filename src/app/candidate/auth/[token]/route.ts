import { NextRequest, NextResponse } from "next/server";
import { getPublicAppUrl, getRequestBasePath, withBasePath } from "@/lib/app-url";
import {
  CANDIDATE_SESSION_COOKIE_NAME,
  consumeCandidateAccessToken,
  getCandidateSessionCookieOptions
} from "@/lib/auth/candidate-session";
import { isCandidateToken } from "@/lib/auth/candidate-token";

type CandidateAuthRouteProps = {
  params: Promise<{ token: string }>;
};

function redirectForRequest(request: NextRequest, pathAndSearch: string, status: 302 | 303 = 303) {
  const basePath = getRequestBasePath(request.nextUrl.basePath);
  const target = withBasePath(pathAndSearch, basePath);
  // NextURL stores basePath separately and adds it again when serialized. Use
  // an ordinary URL for this raw Route Handler; otherwise setting a
  // base-prefixed NextURL pathname doubles the prefix. In production the
  // externally configured HTTPS origin is authoritative: request.url can be
  // an internal HTTP URL behind a TLS-terminating reverse proxy.
  const location =
    process.env.NODE_ENV === "production"
      ? new URL(getPublicAppUrl(pathAndSearch))
      : new URL(target, request.url);

  const response = NextResponse.redirect(location, status);
  // A bearer token must never be cached or propagated as a referrer while the
  // browser transitions from the emailed URL to the clean candidate URL.
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, noarchive");
  return response;
}

/**
 * GET intentionally does not consume a magic link. Email security scanners
 * and link previews commonly issue GETs; consumption happens only after the
 * candidate confirms with the POST form on the intermediate page.
 */
export async function GET(request: NextRequest, { params }: CandidateAuthRouteProps) {
  const { token } = await params;

  if (!isCandidateToken(token)) {
    return redirectForRequest(request, "/join?access=invalid");
  }

  return redirectForRequest(request, `/candidate/auth/confirm/${encodeURIComponent(token)}`, 302);
}

export async function POST(request: NextRequest, { params }: CandidateAuthRouteProps) {
  const { token } = await params;
  const consumed = await consumeCandidateAccessToken(token);

  if (!consumed) {
    return redirectForRequest(request, "/join?access=invalid");
  }

  const basePath = getRequestBasePath(request.nextUrl.basePath);
  const response = redirectForRequest(request, `/candidate/${consumed.groupCode}`);
  response.cookies.set(
    CANDIDATE_SESSION_COOKIE_NAME,
    consumed.sessionToken,
    getCandidateSessionCookieOptions(consumed.expiresAt, basePath)
  );
  return response;
}
