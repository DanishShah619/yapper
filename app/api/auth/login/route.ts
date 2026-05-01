import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import { setSession } from '@/lib/session';
import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { withSecurityHeaders } from '@/lib/security-headers';

type LoginBody = {
  email: string;
  password: string;
};

export const POST = withSecurityHeaders(async (request: Request) => {
  const { email, password } = await request.json() as LoginBody;
  const normalizedEmail = email.toLowerCase();

  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const rateLimitResult = await rateLimit(
    `ratelimit:auth:${clientIp}:${normalizedEmail}`,
    5,
    900,
  );

  if (!rateLimitResult.allowed) {
    return Response.json(
      { error: 'Too many login attempts. Please try again in 15 minutes.' },
      { status: 429 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return Response.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return Response.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const jwt = generateToken(user.id);
  await setSession(user.id, jwt);

  const csrfToken = generateCsrfToken();
  (await cookies()).set('nexchat_token', jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  await setCsrfCookie(csrfToken);

  return Response.json({ success: true });
});
