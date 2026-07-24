import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

type RateLimiterOptions = {
  maxBuckets?: number;
};

type RateLimitClient = Pick<PrismaClient, "$queryRaw">;

type HeaderReader = {
  get(name: string): string | null;
};

const DEFAULT_MAX_BUCKETS = 10_000;
const MAX_RATE_LIMIT_KEY_LENGTH = 256;
const MAX_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const EXPIRED_BUCKET_RETENTION_MS = 24 * 60 * 60 * 1000;

export class RateLimitError extends Error {
  constructor(message = "操作过于频繁，请稍后再试。") {
    super(message);
    this.name = "RateLimitError";
  }
}

function assertConfiguration({ key, limit, windowMs, now }: Required<RateLimitInput>) {
  if (
    !key ||
    key.length > MAX_RATE_LIMIT_KEY_LENGTH ||
    /[\u0000\r\n]/.test(key) ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    !Number.isSafeInteger(windowMs) ||
    windowMs < 1 ||
    windowMs > MAX_RATE_LIMIT_WINDOW_MS ||
    !Number.isSafeInteger(now)
  ) {
    throw new RateLimitError("请求无效，请稍后再试。");
  }
}

function evictOneBucket(buckets: Map<string, Bucket>, now: number) {
  let earliestKey: string | undefined;
  let earliestResetAt = Number.POSITIVE_INFINITY;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
      return;
    }

    if (bucket.resetAt < earliestResetAt) {
      earliestKey = key;
      earliestResetAt = bucket.resetAt;
    }
  }

  if (earliestKey) {
    buckets.delete(earliestKey);
  }
}

/**
 * A bounded in-process limiter retained for deterministic unit tests and
 * local-only callers. Production actions use the shared database-backed
 * `assertRateLimit` below, so replicas and restarts do not reset quotas.
 */
export function createRateLimiter({ maxBuckets = DEFAULT_MAX_BUCKETS }: RateLimiterOptions = {}) {
  if (!Number.isSafeInteger(maxBuckets) || maxBuckets < 1) {
    throw new Error("maxBuckets must be a positive safe integer.");
  }

  const buckets = new Map<string, Bucket>();

  function assertRateLimit({ key, limit, windowMs, now = Date.now() }: RateLimitInput) {
    assertConfiguration({ key, limit, windowMs, now });

    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      if (current) {
        buckets.delete(key);
      }
      if (buckets.size >= maxBuckets) {
        evictOneBucket(buckets, now);
      }
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (current.count >= limit) {
      throw new RateLimitError();
    }

    current.count += 1;
  }

  return {
    assertRateLimit,
    clear: () => buckets.clear(),
    size: () => buckets.size
  };
}

/**
 * Atomically claim one shared fixed-window permit. PostgreSQL is deliberately
 * the authority here: restarting a web worker or adding replicas no longer
 * resets limits. The conditional upsert returns no row once an active bucket
 * reaches its limit.
 */
export async function assertRateLimit(
  { key, limit, windowMs, now = Date.now() }: RateLimitInput,
  client: RateLimitClient = prisma
) {
  assertConfiguration({ key, limit, windowMs, now });

  const resetAt = new Date(now + windowMs);
  const rows = await client.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "createdAt", "updatedAt")
    VALUES (${key}, 1, ${resetAt}, NOW(), NOW())
    ON CONFLICT ("key") DO UPDATE
    SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN ${resetAt}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = NOW()
    WHERE
      "RateLimitBucket"."resetAt" <= NOW()
      OR "RateLimitBucket"."count" < ${limit}
    RETURNING "count"
  `);

  if (rows.length !== 1) {
    throw new RateLimitError();
  }
}

/**
 * Keep the small shared table bounded even when attackers generate many
 * unique hashed identities. This is called by the existing minute-level
 * outbox worker and can also be invoked by an operations job.
 */
export async function pruneExpiredRateLimitBuckets(now = new Date()) {
  return prisma.rateLimitBucket.deleteMany({
    where: {
      resetAt: { lt: new Date(now.getTime() - EXPIRED_BUCKET_RETENTION_MS) }
    }
  });
}

/** Avoid retaining raw email addresses or IP addresses as Map keys. */
export function createRateLimitKey(namespace: string, identity: string) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(namespace) || !identity || identity.length > 512) {
    throw new RateLimitError("请求无效，请稍后再试。");
  }

  const identityHash = createHash("sha256").update(identity).digest("base64url");
  return `${namespace}:${identityHash}`;
}

function isTrustProxyEnabled() {
  const value = process.env.TRUST_PROXY?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/**
 * Only honour forwarding headers when the deployment explicitly declares a
 * trusted proxy. Without that declaration the caller receives null and can
 * apply a conservative shared fallback bucket instead of accepting a spoofed
 * client-provided IP address.
 */
export function getTrustedClientIp(headers: HeaderReader) {
  if (!isTrustProxyEnabled()) {
    return null;
  }

  const forwarded = headers.get("x-forwarded-for");
  // A trusted reverse proxy should overwrite X-Real-IP with the immediate
  // client address. Prefer it over an attacker-supplied first XFF element;
  // when it is unavailable, use the right-most XFF address added by the
  // trusted proxy rather than the spoofable left-most value.
  const candidate = headers.get("x-real-ip")?.trim() || forwarded?.split(",").at(-1)?.trim();

  return candidate && isIP(candidate) !== 0 ? candidate : null;
}
