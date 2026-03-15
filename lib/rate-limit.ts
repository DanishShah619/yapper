import redis from './redis';

/**
 * Sliding-window rate limiter using Redis INCR + EXPIRE.
 *
 * @param key - Unique key for the rate limit scope (e.g., `ratelimit:auth:192.168.1.1`)
 * @param maxAttempts - Maximum number of attempts allowed within the window
 * @param windowSeconds - Duration of the sliding window in seconds
 * @returns Object with `allowed` (boolean) and `remaining` attempts
 */
export async function rateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const current = await redis.incr(key);

  // Set expiry only on the first increment (when the window starts)
  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }

  const remaining = Math.max(0, maxAttempts - current);

  return {
    allowed: current <= maxAttempts,
    remaining,
  };
}
