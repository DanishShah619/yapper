import { cookies } from 'next/headers';

export async function POST() {
  cookies().delete('nexchat_token');
  cookies().delete('csrf_token');
  return Response.json({ success: true });
}
