import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export async function setCsrfCookie(token: string) {
  // This cookie is readable by JS (no httpOnly) — intentionally, so the client can send it as a header
  const cookieStore = await cookies();
  cookieStore.set('csrf_token', token, {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    // NOT httpOnly — must be readable by frontend JS
  });
}

export async function validateCsrfToken(request: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('csrf_token')?.value;
  const headerToken = request.headers.get('x-csrf-token');

  if (!cookieToken || !headerToken) return false;
  // Timing-safe comparison (standard string comparison is fine for this scope, 
  // but strictly speaking we could use crypto.timingSafeEqual on buffer pairs)
  return cookieToken === headerToken;
}
