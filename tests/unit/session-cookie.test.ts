import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdminSessionCookieOptions, shouldUseSecureAdminCookie } from "@/lib/auth/session";

describe("admin session cookie security", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed by marking production cookies secure even if APP_URL is accidentally HTTP", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "http://120.24.108.234/when2entretien");
    vi.stubEnv("SESSION_COOKIE_SECURE", "");

    expect(shouldUseSecureAdminCookie()).toBe(true);
  });

  it("marks cookies secure for HTTPS deployments", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://example.com/when2entretien");
    vi.stubEnv("SESSION_COOKIE_SECURE", "");

    expect(shouldUseSecureAdminCookie()).toBe(true);
  });

  it("does not allow an explicit insecure override in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://example.com/when2entretien");
    vi.stubEnv("SESSION_COOKIE_SECURE", "false");

    expect(shouldUseSecureAdminCookie()).toBe(true);
  });

  it("allows a secure override for a local HTTPS test and scopes cookies to the base path", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/when2entretien");
    vi.stubEnv("SESSION_COOKIE_SECURE", "true");

    expect(getAdminSessionCookieOptions(new Date("2030-01-01T00:00:00.000Z"))).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/when2entretien"
    });
  });
});
