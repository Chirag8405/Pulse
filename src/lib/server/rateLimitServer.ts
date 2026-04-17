import "server-only";
import { createHash } from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import { apiLogger } from "@/lib/google/logging";
import { checkRateLimit, type RateLimitResult } from "@/lib/server/rateLimit";

interface RateLimitBucketDoc {
  count?: unknown;
}

const ENABLE_DISTRIBUTED_RATE_LIMIT =
  process.env.ENABLE_DISTRIBUTED_RATE_LIMIT === "true";

function toSafeCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return 0;
}

function toBucketId(key: string, windowStart: number): string {
  const keyHash = createHash("sha256").update(key).digest("hex").slice(0, 24);
  return `${keyHash}-${windowStart}`;
}

export async function checkServerRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (!ENABLE_DISTRIBUTED_RATE_LIMIT) {
    return checkRateLimit(key, maxRequests, windowMs);
  }

  const now = Date.now();
  const windowStart = now - (now % windowMs);
  const resetAt = windowStart + windowMs;
  const bucketRef = adminDb.collection("rate_limit").doc(toBucketId(key, windowStart));

  try {
    const nextCount = await adminDb.runTransaction(async (transaction) => {
      const bucketSnapshot = await transaction.get(bucketRef);
      const currentCount = bucketSnapshot.exists
        ? toSafeCount((bucketSnapshot.data() as RateLimitBucketDoc).count)
        : 0;
      const incrementedCount = currentCount + 1;

      transaction.set(
        bucketRef,
        {
          count: incrementedCount,
          windowStart: new Date(windowStart),
          resetAt: new Date(resetAt),
          expiresAt: new Date(resetAt),
          updatedAt: new Date(),
        },
        { merge: true }
      );

      return incrementedCount;
    });

    return {
      allowed: nextCount <= maxRequests,
      remaining: Math.max(0, maxRequests - nextCount),
      resetAt,
    };
  } catch (error) {
    apiLogger.warn("Distributed rate limit check failed; using in-memory fallback", {
      error: error instanceof Error ? error.message : String(error),
    });

    return checkRateLimit(key, maxRequests, windowMs);
  }
}
