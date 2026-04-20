import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import Redis from 'ioredis';
import { cookies } from 'next/headers';
import { validateCsrfToken } from '@/lib/csrf';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    if (!validateCsrfToken(request)) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const { token } = await params;
    const jwtToken = cookies().get('nexchat_token')?.value;

    if (!jwtToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(jwtToken);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.userId;

    // Fetch invite from Redis
    const inviteDataStr = await redis.get(`invite:${token}`);
    if (!inviteDataStr) {
      return NextResponse.json({ error: 'Invite link is invalid or has expired' }, { status: 404 });
    }

    const inviteData = JSON.parse(inviteDataStr) as { type: 'group' | 'room'; id: string };

    if (inviteData.type === 'group') {
      const group = await prisma.group.findUnique({ where: { id: inviteData.id } });
      if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

      // Add to group
      const existing = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: inviteData.id, userId } },
      });

      if (!existing) {
        await prisma.groupMember.create({
          data: { groupId: inviteData.id, userId, role: 'MEMBER' },
        });
      }

      return NextResponse.json({ url: `/groups/${inviteData.id}` });
      
    } else if (inviteData.type === 'room') {
      const room = await prisma.room.findUnique({ where: { id: inviteData.id } });
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

      // Add to room
      const existing = await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId: inviteData.id, userId } },
      });

      if (!existing) {
        await prisma.roomMember.create({
          data: { roomId: inviteData.id, userId, role: 'MEMBER' },
        });
      }

      return NextResponse.json({ url: `/chat/${inviteData.id}` });
    }

    return NextResponse.json({ error: 'Invalid invite type' }, { status: 400 });

  } catch (error: any) {
    console.error('Invite Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
