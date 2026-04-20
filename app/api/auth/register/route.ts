import { cookies } from 'next/headers';
import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf';

// Execute GraphQL server-side
async function executeGraphQL(query: string, variables: any) {
  const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

export async function POST(request: Request) {
  const { email, username, password } = await request.json();

  const result = await executeGraphQL(`
    mutation Register($email: String!, $username: String!, $password: String!) {
      register(email: $email, username: $username, password: $password) {
        token
      }
    }
  `, { email, username, password });

  if (result.errors || !result.data?.register?.token) {
    return Response.json({ error: result.errors?.[0]?.message || 'Registration failed' }, { status: 400 });
  }

  const jwt = result.data.register.token;
  const csrfToken = generateCsrfToken();

  cookies().set('nexchat_token', jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });

  setCsrfCookie(csrfToken);

  return Response.json({ success: true });
}
