import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';
import { deleteSession } from '@/lib/session';
import { withSecurityHeaders } from '@/lib/security-headers';

export const POST = withSecurityHeaders(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexchat_token')?.value;

  if (token) {
    const userId = await validateSession(token);
    if (userId) {
      await deleteSession(userId, token);
    }
  }

  cookieStore.delete('nexchat_token');
  cookieStore.delete('csrf_token');
  return Response.json({ success: true });
});
