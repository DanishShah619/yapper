import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import { setSession } from '@/lib/session';
import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf';
import { withSecurityHeaders } from '@/lib/security-headers';

type RegisterBody = {
  email: string;
  username: string;
  password: string;
};

export const POST = withSecurityHeaders(async (request: Request) => {
  const body = await request.json();
  const { validateInput, registerSchema } = await import('@/lib/validation');
  const { email, username, password } = validateInput(registerSchema, body) as RegisterBody;

  const normalizedEmail = email.toLowerCase();
  const normalizedUsername = username.toLowerCase();

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalizedEmail }, { username: normalizedUsername }],
    },
  });

  if (existingUser) {
    const message = existingUser.email === normalizedEmail
      ? 'Email already in use'
      : 'Username already taken';
    return Response.json({ error: message }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      username: normalizedUsername,
      passwordHash,
    },
  });

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
