import { cookies } from 'next/headers';
import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf';
import { withSecurityHeaders } from '@/lib/security-headers';

// Execute GraphQL server-side
async function executeGraphQL(query: string, variables: any) {
  const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

export const POST = withSecurityHeaders(async (request: Request) => {
  const { email, password } = await request.json();

  const result = await executeGraphQL(`
    mutation Login($email: String!, $password: String!) {
      login(email: $email, password: $password) {
        token
      }
    }
  `, { email, password });

  if (result.errors || !result.data?.login?.token) {
    return Response.json({ error: result.errors?.[0]?.message || 'Invalid credentials' }, { status: 401 });
  }

  const jwt = result.data.login.token;
  const csrfToken = generateCsrfToken();

  (await cookies()).set('nexchat_token', jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });

  setCsrfCookie(csrfToken);
  return Response.json({ success: true })
});
  

