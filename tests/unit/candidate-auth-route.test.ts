import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const candidateSessionMocks = vi.hoisted(() => ({
  consumeCandidateAccessToken: vi.fn(),
  getCandidateSessionCookieOptions: vi.fn()
}));

vi.mock("@/lib/auth/candidate-session", () => ({
  CANDIDATE_SESSION_COOKIE_NAME: "interview_candidate_session",
  consumeCandidateAccessToken: candidateSessionMocks.consumeCandidateAccessToken,
  getCandidateSessionCookieOptions: candidateSessionMocks.getCandidateSessionCookieOptions
}));

import { GET, POST } from "@/app/candidate/auth/[token]/route";

const token = "a".repeat(43);

function requestFor(path = `/when2entretien/candidate/auth/${token}`) {
  return new NextRequest(`https://example.test${path}`, {
    nextConfig: { basePath: "/when2entretien" }
  });
}

describe("candidate magic-link route", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/when2entretien");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://example.test/when2entretien");
    candidateSessionMocks.consumeCandidateAccessToken.mockReset();
    candidateSessionMocks.getCandidateSessionCookieOptions.mockReset();
    candidateSessionMocks.getCandidateSessionCookieOptions.mockImplementation(
      (expiresAt: Date, basePath: string) => ({
        httpOnly: true,
        sameSite: "lax" as const,
        secure: true,
        path: basePath,
        expires: expiresAt
      })
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not consume a valid token on GET and retains the base path for confirmation", async () => {
    const response = await GET(requestFor(), {
      params: Promise.resolve({ token })
    });

    expect(candidateSessionMocks.consumeCandidateAccessToken).not.toHaveBeenCalled();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      `https://example.test/when2entretien/candidate/auth/confirm/${token}`
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("uses the configured public HTTPS origin rather than an internal proxy request URL", async () => {
    const internalRequest = new NextRequest(
      `http://127.0.0.1:5162/when2entretien/candidate/auth/${token}`,
      {
        nextConfig: { basePath: "/when2entretien" }
      }
    );

    const response = await GET(internalRequest, {
      params: Promise.resolve({ token })
    });

    expect(response.headers.get("location")).toBe(
      `https://example.test/when2entretien/candidate/auth/confirm/${token}`
    );
  });

  it("uses a base-path-scoped secure cookie and a clean success redirect after POST", async () => {
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");
    candidateSessionMocks.consumeCandidateAccessToken.mockResolvedValue({
      sessionToken: "b".repeat(43),
      expiresAt,
      groupCode: "K7Q9-M2TD-8F6P-W4ZX-N3CY"
    });

    const response = await POST(requestFor(), {
      params: Promise.resolve({ token })
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://example.test/when2entretien/candidate/K7Q9-M2TD-8F6P-W4ZX-N3CY"
    );
    expect(candidateSessionMocks.getCandidateSessionCookieOptions).toHaveBeenCalledWith(
      expiresAt,
      "/when2entretien"
    );
    expect(response.headers.get("set-cookie")).toContain("Path=/when2entretien");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("redirects failed POST consumption to the base-path join page without echoing the token", async () => {
    candidateSessionMocks.consumeCandidateAccessToken.mockResolvedValue(null);

    const response = await POST(requestFor(), {
      params: Promise.resolve({ token })
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://example.test/when2entretien/join?access=invalid"
    );
    expect(response.headers.get("location")).not.toContain(token);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects malformed GET tokens before showing the confirmation page", async () => {
    const response = await GET(requestFor("/when2entretien/candidate/auth/not-a-token"), {
      params: Promise.resolve({ token: "not-a-token" })
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://example.test/when2entretien/join?access=invalid"
    );
  });
});
