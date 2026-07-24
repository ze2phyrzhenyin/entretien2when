import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCandidateGroupPublicUrl,
  getPublicAppUrl,
  getSessionCookiePath,
  normalizeBasePath,
  withBasePath
} from "@/lib/app-url";

describe("application base path helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefixes raw route-handler paths and scopes cookies to the configured base path", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/when2entretien/");

    expect(withBasePath("/candidate/A1")).toBe("/when2entretien/candidate/A1");
    expect(withBasePath("/when2entretien/candidate/A1")).toBe("/when2entretien/candidate/A1");
    expect(getSessionCookiePath()).toBe("/when2entretien");
  });

  it("builds public links once whether APP_URL includes the base path or not", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/when2entretien");
    vi.stubEnv("APP_URL", "https://example.test/when2entretien");

    expect(getPublicAppUrl("/candidate/auth/token")).toBe(
      "https://example.test/when2entretien/candidate/auth/token"
    );
    expect(getCandidateGroupPublicUrl("group/A 1")).toBe(
      "https://example.test/when2entretien/candidate/group%2FA%201"
    );

    vi.stubEnv("APP_URL", "https://example.test");
    expect(getPublicAppUrl("/candidate/auth/token")).toBe(
      "https://example.test/when2entretien/candidate/auth/token"
    );
  });

  it("fails closed for an unsafe production APP_URL", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "http://example.test/when2entretien");
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/when2entretien");

    expect(() => getPublicAppUrl("/candidate/auth/token")).toThrow(/HTTPS/);
  });

  it("fails closed when APP_URL and the built base path disagree", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://example.test/when2entretien");
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");

    expect(() => getPublicAppUrl("/candidate/auth/token")).toThrow(/BASE_PATH/);
  });

  it("rejects a public URL that embeds credentials", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_URL", "https://user:secret@example.test");
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");

    expect(() => getPublicAppUrl("/candidate/auth/token")).toThrow(/credentials/);
  });

  it("rejects malformed base path configuration instead of falling back to root cookies", () => {
    expect(() => normalizeBasePath("when2entretien")).toThrow(/invalid/);
    expect(() => normalizeBasePath("//when2entretien")).toThrow(/invalid/);
    expect(() => normalizeBasePath("/when2entretien?debug=1")).toThrow(/invalid/);
  });
});
