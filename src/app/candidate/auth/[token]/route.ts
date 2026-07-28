import { NextRequest, NextResponse } from "next/server";
import { getPublicAppUrl, getRequestBasePath, withBasePath } from "@/lib/app-url";
import {
  consumeCandidateAccessToken,
  getCandidateSessionCookieName,
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
 * Compatibility route for links issued before fragment-based tokens. A legacy
 * request may already have exposed its token to an access log, so immediately
 * move it into a fragment and issue no new legacy links.
 */
export async function GET(request: NextRequest, { params }: CandidateAuthRouteProps) {
  const { token } = await params;

  if (!isCandidateToken(token)) {
    return redirectForRequest(request, "/join?access=invalid");
  }

  return redirectForRequest(request, `/candidate/auth/confirm#${encodeURIComponent(token)}`, 302);
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
    getCandidateSessionCookieName(consumed.groupId),
    consumed.sessionToken,
    getCandidateSessionCookieOptions(consumed.expiresAt, basePath)
  );
  return response;
}
