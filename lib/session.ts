import redis from './redis';
import { createHash } from 'crypto';

const SESSION_PREFIX = 'session:';

function sessionKey(userId: string, token: string): string {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return `${SESSION_PREFIX}${userId}:${tokenHash}`;
}

function legacySessionKey(userId: string): string {
  return `${SESSION_PREFIX}${userId}`;
}

/**
 * Cache a JWT session in Redis.
 * TTL in seconds (default 7 days = 604800).
 *
 * Sessions are keyed by token hash so one user can stay logged in on multiple
 * devices without newer logins invalidating older devices.
 */
export async function setSession(
  userId: string,
  token: string,
  ttlSeconds: number = 604800
): Promise<void> {
  await redis.set(sessionKey(userId, token), 'active', 'EX', ttlSeconds);
}

/**
 * Retrieve a cached session token for a user.
 * Returns null if expired or not found.
 */
export async function getSession(userId: string, token: string): Promise<string | null> {
  const activeSession = await redis.get(sessionKey(userId, token));
  if (activeSession) return token;

  // Backward compatibility for tokens created before multi-device sessions.
  const legacyToken = await redis.get(legacySessionKey(userId));
  return legacyToken === token ? legacyToken : null;
}

/**
 * Delete a session. When a token is supplied, only that device/session is
 * logged out. Without a token, only the legacy single-session key is removed.
 */
export async function deleteSession(userId: string, token?: string): Promise<void> {
  if (token) {
    await redis.del(sessionKey(userId, token));
    return;
  }

  await redis.del(legacySessionKey(userId));
}
