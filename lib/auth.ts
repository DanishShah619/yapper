import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { getSession } from './session';

const JWT_SECRET = process.env.JWT_SECRET || 'nexchat-dev-secret-change-in-production-2025';
const JWT_EXPIRES_IN: jwt.SignOptions['expiresIn'] =
  (process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']) ?? '7d';

export interface JwtPayload {
  userId: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate a signed JWT for a user.
 */
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    jwtid: randomUUID(),
  });
}

/**
 * Verify and decode a JWT. Returns the payload or null if invalid/expired.
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Extract Bearer token from an Authorization header string.
 */
export function extractToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

/**
 * Validate a token against Redis session cache.
 * Returns the userId if valid, or null if the session was invalidated.
 */
export async function validateSession(token: string): Promise<string | null> {
  const payload = verifyToken(token);
  if (!payload) return null;

  // Check if session still exists in Redis (not logged out)
  const cachedToken = await getSession(payload.userId, token);
  if (!cachedToken || cachedToken !== token) return null;

  return payload.userId;
}
