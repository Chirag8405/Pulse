/**
 * In-memory rate limiter for API routes.
 * Uses a sliding-window counter pattern suitable for Cloud Run.
 *
 * For production at scale, replace with a Redis-backed limiter
 * or Cloud Armor rate-limiting rules.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 60;  // 60 requests per minute

const buckets = new Map<string, RateLimitEntry>();

// Periodically purge expired entries to prevent memory leaks.
const CLEANUP_INTERVAL_MS = 5 * 60_000; // 5 minutes

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();

    for (const [key, entry] of buckets) {
      if (entry.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS).unref?.();
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Checks whether a request from the given key (e.g. uid or IP)
 * is within the rate limit.
 */
export function checkRateLimit(
  key: string,
  maxRequests = DEFAULT_MAX_REQUESTS,
  windowMs = DEFAULT_WINDOW_MS
): RateLimitResult {
  const now = Date.now();
  const entry = buckets.get(key);

  // First request or window expired — reset.
  if (!entry || entry.resetAt <= now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };

    buckets.set(key, newEntry);

    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Within window — increment counter.
  entry.count += 1;

  if (entry.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Resets the rate limit for a given key.
 */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/**
 * Returns rate-limit HTTP headers for inclusion in API responses.
 */
export function rateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": new Date(result.resetAt).toUTCString(),
  };
}
