import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldUseSecureAdminCookie } from "@/lib/auth/session";

describe("admin session cookie security", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not mark cookies secure for the current HTTP deployment", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "http://120.24.108.234/when2entretien");
    vi.stubEnv("SESSION_COOKIE_SECURE", "");

    expect(shouldUseSecureAdminCookie()).toBe(false);
  });

  it("marks cookies secure for HTTPS deployments", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://example.com/when2entretien");
    vi.stubEnv("SESSION_COOKIE_SECURE", "");

    expect(shouldUseSecureAdminCookie()).toBe(true);
  });

  it("allows an explicit environment override", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://example.com/when2entretien");
    vi.stubEnv("SESSION_COOKIE_SECURE", "false");

    expect(shouldUseSecureAdminCookie()).toBe(false);
  });
});
