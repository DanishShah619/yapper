// server.ts
// Custom Express + Socket.IO server for NexChat
// Integrates with Next.js App Router, Redis adapter, JWT auth

import { env, verifyRedisConnection } from './lib/env';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import next from 'next';
import { setIO } from './lib/socketIO';
import { markShardAcknowledged, markShardDecrypted } from './lib/keyDelivery';
import { prisma } from './lib/prisma';
import redis from './lib/redis';
import { pubsub } from './graphql/context';
import { verifyToken, validateSession } from './lib/auth';

const dev = env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

type SocketUser = {
  userId?: string;
  username?: string;
  exp?: number;
};

type DependencyStatus = 'ok' | 'error';

type WaitingRoomUser = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

async function withTimeout<T>(label: string, operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} check timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function checkReadiness(): Promise<{
  db: DependencyStatus;
  redis: DependencyStatus;
  errors: string[];
}> {
  const errors: string[] = [];
  let db: DependencyStatus = 'ok';
  let redisStatus: DependencyStatus = 'ok';

  try {
    await withTimeout('database', prisma.$queryRaw`SELECT 1`, 2000);
  } catch (error) {
    db = 'error';
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`db: ${message}`);
    console.warn('[readyz] database check failed:', message);
  }

  try {
    await withTimeout('redis', redis.ping(), 2000);
  } catch (error) {
    redisStatus = 'error';
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`redis: ${message}`);
    console.warn('[readyz] Redis check failed:', message);
  }

  return { db, redis: redisStatus, errors };
}

function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) return null;

  return decodeURIComponent(cookie.slice(name.length + 1));
}

async function main() {
  await verifyRedisConnection();
  await app.prepare();
  const server = express();
  const httpServer = createServer(server);

  server.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  server.get('/readyz', async (_req, res) => {
    const readiness = await checkReadiness();
    const isReady = readiness.db === 'ok' && readiness.redis === 'ok';

    if (isReady) {
      res.status(200).json({ status: 'ready', db: 'ok', redis: 'ok' });
      return;
    }

    res.status(503).json({
      status: 'degraded',
      db: readiness.db,
      redis: readiness.redis,
      error: readiness.errors.join('; '),
    });
  });

  // Redis clients for Socket.IO adapter
  const pubClient = createClient({ url: env.REDIS_URL });
  const subClient = pubClient.duplicate();
  await pubClient.connect();
  await subClient.connect();

  // Socket.IO setup
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.NODE_ENV === 'production' ? env.APP_ORIGIN : true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io',
  });
  io.adapter(createAdapter(pubClient, subClient));
  // Register io singleton so lib/keyDelivery.ts can access it
  setIO(io);

  // JWT auth middleware
  io.use(async (socket, next) => {
    let token = socket.handshake.auth?.token || socket.handshake.headers['authorization'];

    // Fallback to cookie if HTTPOnly migration removed localStorage token
    if (!token) token = getCookieValue(socket.handshake.headers.cookie, 'nexchat_token');

    if (!token) return next(new Error('Authentication required'));
    try {
      const normalizedToken = String(token).replace('Bearer ', '');
      const userId = await validateSession(normalizedToken);
      const payload = verifyToken(normalizedToken);
      if (!userId || !payload) return next(new Error('Invalid token'));
      socket.data.user = payload as SocketUser;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // Event namespaces
  io.on('connection', (socket) => {
    const userId = (socket.data.user as SocketUser | undefined)?.userId;

    // Verify token expiration on every incoming packet
    socket.use((packet, next) => {
      const exp = (socket.data.user as SocketUser | undefined)?.exp;
      if (exp && Date.now() >= exp * 1000) {
        return next(new Error('Token expired'));
      }
      next();
    });

    // Subscribe to personal channels for targeted events
    if (userId) {
      socket.join(`admin:${userId}`);
      socket.join(`user:${userId}`);
    }

    async function canAccessConversation(conversationId: string) {
      if (!userId || !conversationId) return false;

      const [roomMember, groupMember] = await Promise.all([
        prisma.roomMember.findFirst({
          where: { roomId: conversationId, userId },
          select: { id: true },
        }),
        prisma.groupMember.findFirst({
          where: { groupId: conversationId, userId },
          select: { id: true },
        }),
      ]);

      return Boolean(roomMember || groupMember);
    }

    // Messaging events. Message creation happens through GraphQL; Socket.IO is the
    // authenticated delivery channel for saved messages and typing indicators.
    socket.on('joinRoom', async (roomId) => {
      if (typeof roomId !== 'string') return;
      if (await canAccessConversation(roomId)) {
        socket.join(roomId);
      }
    });
    socket.on('leaveRoom', (roomId) => {
      if (typeof roomId === 'string') {
        socket.leave(roomId);
      }
    });
    socket.on('typing:start', async (data) => {
      const roomId = data?.roomId;
      if (typeof roomId !== 'string' || !(await canAccessConversation(roomId))) return;
      socket.to(roomId).emit('typing:start', {
        roomId,
        userId,
        username: (socket.data.user as SocketUser | undefined)?.username ?? 'Someone',
      });
    });
    socket.on('typing:stop', async (data) => {
      const roomId = data?.roomId;
      if (typeof roomId !== 'string' || !(await canAccessConversation(roomId))) return;
      socket.to(roomId).emit('typing:stop', {
        roomId,
        userId,
        username: (socket.data.user as SocketUser | undefined)?.username ?? 'Someone',
      });
    });
    // Presence events
    socket.on('presence:heartbeat', async () => {
      if (!userId) return;
      const key = `presence:${userId}`;
      const isNew = await pubClient.set(key, 'online', { EX: 30, NX: true });
      if (isNew) {
        // Just went online, notify friends
        const friends = await prisma.friendship.findMany({
          where: {
            OR: [{ requesterId: userId }, { addresseeId: userId }],
            status: 'ACCEPTED'
          }
        });
        const friendIds = friends.map(f => f.requesterId === userId ? f.addresseeId : f.requesterId);
        friendIds.forEach((id: string) => {
          pubsub.publish(`presenceUpdated:${id}`, {
            presenceUpdated: { userId, online: true }
          });
        });
      } else {
        // Already online, just update TTL
        await pubClient.set(key, 'online', { EX: 30 });
      }
    });

    socket.on('disconnect', async () => {
      if (!userId) return;
      await pubClient.del(`presence:${userId}`);

      const friends = await prisma.friendship.findMany({
        where: {
          OR: [{ requesterId: userId }, { addresseeId: userId }],
          status: 'ACCEPTED'
        }
      });
      const friendIds = friends.map(f => f.requesterId === userId ? f.addresseeId : f.requesterId);
      friendIds.forEach((id: string) => {
        pubsub.publish(`presenceUpdated:${id}`, {
          presenceUpdated: { userId, online: false }
        });
      });
    });
    // Video/waiting room events
    socket.on('waiting:join', async (data) => {
      const { roomId } = data;
      if (!roomId || !userId) return;

      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, username: true, avatarUrl: true },
        });
        if (!user) return;

        // Add to Redis waiting room set
        await pubClient.sAdd(`waitingroom:${roomId}`, userId);

        // Let the host/admin know the waiting room was updated
        io.to(`videoadmin:${roomId}`).emit('waiting:joined', { roomId, user });
      } catch (err) {
        console.error('[Video] waiting:join handler error:', err);
      }
    });

    socket.on('waiting:leave', async (data) => {
      const { roomId } = data;
      if (!roomId || !userId) return;

      try {
        await pubClient.sRem(`waitingroom:${roomId}`, userId);
        io.to(`videoadmin:${roomId}`).emit('waiting:left', { roomId, userId });
      } catch (err) {
        console.error('[Video] waiting:leave handler error:', err);
      }
    });

    socket.on('videoadmin:join', async ({ roomId }) => {
      if (!userId || !roomId) return;
      try {
        const room = await prisma.videoRoom.findUnique({ where: { id: roomId } });
        if (room?.createdBy === userId) {
          socket.join(`videoadmin:${roomId}`);
          const waitingUserIds = await pubClient.sMembers(`waitingroom:${roomId}`);
          const waitingUsers = waitingUserIds.length
            ? await prisma.user.findMany({
                where: { id: { in: waitingUserIds } },
                select: { id: true, username: true, avatarUrl: true },
              })
            : [];
          const waitingById = new Map(waitingUsers.map((user) => [user.id, user]));
          const orderedWaitingUsers: WaitingRoomUser[] = waitingUserIds
            .map((waitingUserId) => waitingById.get(waitingUserId))
            .filter((user): user is WaitingRoomUser => Boolean(user));

          socket.emit('waiting:sync', { roomId, users: orderedWaitingUsers });
        }
      } catch (err) {
        console.error('[Video] videoadmin:join handler error:', err);
      }
    });

    socket.on('waiting:approve', async ({ roomId, participantId }) => {
      if (!userId || !roomId || !participantId) return;
      try {
        const room = await prisma.videoRoom.findUnique({ where: { id: roomId } });
        if (room?.createdBy !== userId) return;

        await pubClient.sRem(`waitingroom:${roomId}`, participantId);
        io.to(`user:${participantId}`).emit('waiting:approved', { roomId });
        io.to(`videoadmin:${roomId}`).emit('waiting:left', { roomId, userId: participantId });
      } catch (err) {
        console.error('[Video] waiting:approve handler error:', err);
      }
    });

    socket.on('waiting:reject', async ({ roomId, participantId }) => {
      if (!userId || !roomId || !participantId) return;
      try {
        const room = await prisma.videoRoom.findUnique({ where: { id: roomId } });
        if (room?.createdBy !== userId) return;

        await pubClient.sRem(`waitingroom:${roomId}`, participantId);
        io.to(`user:${participantId}`).emit('waiting:rejected', { roomId });
        io.to(`videoadmin:${roomId}`).emit('waiting:left', { roomId, userId: participantId });
      } catch (err) {
        console.error('[Video] waiting:reject handler error:', err);
      }
    });

    /**
     * Client emits after successfully receiving the shard blob from the server.
     * Advances status: DELIVERED → ACKNOWLEDGED.
     */
    socket.on('shard:received', async ({ roomId }: { roomId: string }) => {
      if (!userId || !roomId) return;
      try {
        await markShardAcknowledged(roomId, userId);
      } catch (err) {
        console.error('[KeyDelivery] shard:received handler error:', err);
      }
    });

    /**
     * Client emits ONLY after successfully calling unwrapRoomKey().
     * Advances status: ACKNOWLEDGED → DECRYPTED.
     * This is the terminal success event.
     */
    socket.on('shard:decrypted', async ({ roomId }: { roomId: string }) => {
      if (!userId || !roomId) return;
      try {
        await markShardDecrypted(roomId, userId);
      } catch (err) {
        console.error('[KeyDelivery] shard:decrypted handler error:', err);
      }
    });

    /**
     * Admin client requests to join the room admin channel for live health updates.
     * Verified against DB before joining — prevents non-admins spoofing the channel.
     */
    socket.on('admin:join', async ({ roomId }: { roomId: string }) => {
      if (!userId || !roomId) return;
      try {
        const membership = await prisma.roomMember.findUnique({
          where: { roomId_userId: { roomId, userId } },
        });
        if (membership?.role === 'ADMIN') {
          socket.join(`adminroom:${roomId}`);
        }
      } catch (err) {
        console.error('[KeyDelivery] admin:join handler error:', err);
      }
    });

    // ────────────────────────────────────────────────────────────────────────
  });

  // Next.js request handler
  server.all(/.*/, (req, res) => handle(req, res));

  const port = env.PORT;
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error('Server error:', err);
  process.exit(1);
});
