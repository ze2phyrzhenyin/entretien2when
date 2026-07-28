import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decryptCandidateAccessContent,
  encryptCandidateAccessContent
} from "@/lib/auth/access-link-encryption";

describe("candidate access link encryption", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips content without retaining plaintext", () => {
    vi.stubEnv("NODE_ENV", "test");
    const plaintext = "https://example.test/candidate/auth/confirm#secret-token";
    const encrypted = encryptCandidateAccessContent(plaintext);

    expect(encrypted).not.toContain("secret-token");
    expect(decryptCandidateAccessContent(encrypted)).toBe(plaintext);
  });

  it("requires an explicit 32-byte key in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CANDIDATE_ACCESS_ENCRYPTION_KEY", "");

    expect(() => encryptCandidateAccessContent("secret")).toThrow(
      /CANDIDATE_ACCESS_ENCRYPTION_KEY/
    );
  });
});
