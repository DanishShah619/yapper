import redis from './redis';

const SESSION_PREFIX = 'session:';

/**
 * Cache a JWT session in Redis.
 * TTL in seconds (default 7 days = 604800).
 */
export async function setSession(
  userId: string,
  token: string,
  ttlSeconds: number = 604800
): Promise<void> {
  await redis.set(`${SESSION_PREFIX}${userId}`, token, 'EX', ttlSeconds);
}

/**
 * Retrieve a cached session token for a user.
 * Returns null if expired or not found.
 */
export async function getSession(userId: string): Promise<string | null> {
  return redis.get(`${SESSION_PREFIX}${userId}`);
}

/**
 * Delete a user's session (logout).
 */
export async function deleteSession(userId: string): Promise<void> {
  await redis.del(`${SESSION_PREFIX}${userId}`);
}
