import { cookies } from 'next/headers';
import { withSecurityHeaders } from '@/lib/security-headers';

export const POST = withSecurityHeaders(async () => {
  cookies().delete('nexchat_token');
  cookies().delete('csrf_token');
  return Response.json({ success: true });
});
