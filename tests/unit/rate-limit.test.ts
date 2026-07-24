import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertRateLimit,
  createRateLimiter,
  createRateLimitKey,
  getTrustedClientIp,
  RateLimitError
} from "@/lib/rate-limit";

describe("rate limit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows requests within the window limit", () => {
    const limiter = createRateLimiter();
    expect(() =>
      limiter.assertRateLimit({ key: "unit-rate-ok", limit: 2, windowMs: 60_000, now: 1000 })
    ).not.toThrow();
    expect(() =>
      limiter.assertRateLimit({ key: "unit-rate-ok", limit: 2, windowMs: 60_000, now: 2000 })
    ).not.toThrow();
  });

  it("rejects requests above the window limit until the bucket resets", () => {
    const limiter = createRateLimiter();
    limiter.assertRateLimit({ key: "unit-rate-block", limit: 1, windowMs: 60_000, now: 1000 });
    expect(() =>
      limiter.assertRateLimit({ key: "unit-rate-block", limit: 1, windowMs: 60_000, now: 2000 })
    ).toThrow(RateLimitError);
    expect(() =>
      limiter.assertRateLimit({ key: "unit-rate-block", limit: 1, windowMs: 60_000, now: 61_001 })
    ).not.toThrow();
  });

  it("bounds buckets and rejects oversized untrusted keys", () => {
    const limiter = createRateLimiter({ maxBuckets: 3 });

    for (let index = 0; index < 8; index += 1) {
      limiter.assertRateLimit({ key: `unique-${index}`, limit: 1, windowMs: 60_000, now: 1000 });
    }

    expect(limiter.size()).toBe(3);
    expect(() =>
      limiter.assertRateLimit({ key: "x".repeat(257), limit: 1, windowMs: 60_000, now: 1000 })
    ).toThrow(RateLimitError);
  });

  it("hashes identity components and only trusts proxy-provided IPs when configured", () => {
    const key = createRateLimitKey("candidate-access-identity", "group-a:person@example.com");
    expect(key).not.toContain("person@example.com");
    expect(key).toMatch(/^candidate-access-identity:[A-Za-z0-9_-]+$/);

    const requestHeaders = new Headers({
      "x-forwarded-for": "198.51.100.10, 203.0.113.10"
    });
    expect(getTrustedClientIp(requestHeaders)).toBeNull();

    vi.stubEnv("TRUST_PROXY", "true");
    expect(getTrustedClientIp(requestHeaders)).toBe("203.0.113.10");

    const realIpHeaders = new Headers({
      "x-forwarded-for": "198.51.100.10, 203.0.113.10",
      "x-real-ip": "192.0.2.42"
    });
    expect(getTrustedClientIp(realIpHeaders)).toBe("192.0.2.42");
  });

  it("treats the shared database conditional upsert as the production authority", async () => {
    const allowedClient = {
      $queryRaw: vi.fn().mockResolvedValue([{ count: 1 }])
    };
    await expect(
      assertRateLimit(
        { key: "shared-test", limit: 1, windowMs: 60_000, now: 1_000 },
        allowedClient as never
      )
    ).resolves.toBeUndefined();

    const deniedClient = {
      $queryRaw: vi.fn().mockResolvedValue([])
    };
    await expect(
      assertRateLimit(
        { key: "shared-test", limit: 1, windowMs: 60_000, now: 1_000 },
        deniedClient as never
      )
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});
