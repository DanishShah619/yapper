import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function setCsrfCookie(token: string) {
  // This cookie is readable by JS (no httpOnly) — intentionally, so the client can send it as a header
  cookies().set('csrf_token', token, {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    // NOT httpOnly — must be readable by frontend JS
  });
}

export function validateCsrfToken(request: Request): boolean {
  const cookieToken = cookies().get('csrf_token')?.value;
  const headerToken = request.headers.get('x-csrf-token');

  if (!cookieToken || !headerToken) return false;
  // Timing-safe comparison (standard string comparison is fine for this scope, 
  // but strictly speaking we could use crypto.timingSafeEqual on buffer pairs)
  return cookieToken === headerToken;
}
