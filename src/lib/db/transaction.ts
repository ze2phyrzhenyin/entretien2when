import { Prisma } from "@prisma/client";

const DEFAULT_TRANSACTION_ATTEMPTS = 3;

export const serializableTransactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000
} as const;

export function isSerializationFailure(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

/**
 * PostgreSQL can abort a SERIALIZABLE transaction under legitimate contention.
 * Retrying the complete read/validate/write unit is required for serializable
 * semantics; retries are deliberately limited so callers can still surface a
 * useful conflict message when contention remains high.
 */
export async function withSerializableRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = DEFAULT_TRANSACTION_ATTEMPTS
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isSerializationFailure(error) || attempt === maxAttempts) {
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * Lock state-transition resources in a stable order. The database constraints
 * remain the final authority, while these advisory locks make the common
 * concurrent scheduling paths deterministic and reduce avoidable retries.
 */
export async function lockStateResources(tx: Prisma.TransactionClient, resourceKeys: string[]) {
  const keys = [...new Set(resourceKeys.filter(Boolean))].sort();

  for (const key of keys) {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext('when2entretien:state'),
        hashtext(${key})
      )
    `;
  }
}
