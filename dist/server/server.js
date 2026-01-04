"use strict";
// server.ts
// Custom Express + Socket.IO server for NexChat
// Integrates with Next.js App Router, Redis adapter, JWT auth
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./lib/env");
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const redis_1 = require("redis");
const next_1 = __importDefault(require("next"));
const socketIO_1 = require("./lib/socketIO");
const keyDelivery_1 = require("./lib/keyDelivery");
const prisma_1 = require("./lib/prisma");
const redis_2 = __importDefault(require("./lib/redis"));
const context_1 = require("./graphql/context");
const auth_1 = require("./lib/auth");
const dev = env_1.env.NODE_ENV !== 'production';
const app = (0, next_1.default)({ dev });
const handle = app.getRequestHandler();
async function withTimeout(label, operation, timeoutMs) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${label} check timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    try {
        return await Promise.race([operation, timeout]);
    }
    finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}
async function checkReadiness() {
    const errors = [];
    let db = 'ok';
    let redisStatus = 'ok';
    try {
        await withTimeout('database', prisma_1.prisma.$queryRaw `SELECT 1`, 2000);
    }
    catch (error) {
        db = 'error';
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`db: ${message}`);
        console.warn('[readyz] database check failed:', message);
    }
    try {
        await withTimeout('redis', redis_2.default.ping(), 2000);
    }
    catch (error) {
        redisStatus = 'error';
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`redis: ${message}`);
        console.warn('[readyz] Redis check failed:', message);
    }
    return { db, redis: redisStatus, errors };
}
function getCookieValue(cookieHeader, name) {
    if (!cookieHeader)
        return null;
    const cookie = cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));
    if (!cookie)
        return null;
    return decodeURIComponent(cookie.slice(name.length + 1));
}
async function main() {
    await (0, env_1.verifyRedisConnection)();
    await app.prepare();
    const server = (0, express_1.default)();
    const httpServer = (0, http_1.createServer)(server);
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
    const pubClient = (0, redis_1.createClient)({ url: env_1.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    await pubClient.connect();
    await subClient.connect();
    // Socket.IO setup
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: env_1.env.NODE_ENV === 'production' ? env_1.env.APP_ORIGIN : true,
            methods: ['GET', 'POST'],
            credentials: true,
        },
        path: '/socket.io',
    });
    io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
    // Register io singleton so lib/keyDelivery.ts can access it
    (0, socketIO_1.setIO)(io);
    // JWT auth middleware
    io.use(async (socket, next) => {
        var _a;
        let token = ((_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.token) || socket.handshake.headers['authorization'];
        // Fallback to cookie if HTTPOnly migration removed localStorage token
        if (!token)
            token = getCookieValue(socket.handshake.headers.cookie, 'nexchat_token');
        if (!token)
            return next(new Error('Authentication required'));
        try {
            const normalizedToken = String(token).replace('Bearer ', '');
            const userId = await (0, auth_1.validateSession)(normalizedToken);
            const payload = (0, auth_1.verifyToken)(normalizedToken);
            if (!userId || !payload)
                return next(new Error('Invalid token'));
            socket.data.user = payload;
            next();
        }
        catch (_b) {
            next(new Error('Invalid token'));
        }
    });
    // Event namespaces
    io.on('connection', (socket) => {
        var _a;
        const userId = (_a = socket.data.user) === null || _a === void 0 ? void 0 : _a.userId;
        // Verify token expiration on every incoming packet
        socket.use((packet, next) => {
            var _a;
            const exp = (_a = socket.data.user) === null || _a === void 0 ? void 0 : _a.exp;
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
        async function canAccessConversation(conversationId) {
            if (!userId || !conversationId)
                return false;
            const [roomMember, groupMember] = await Promise.all([
                prisma_1.prisma.roomMember.findFirst({
                    where: { roomId: conversationId, userId },
                    select: { id: true },
                }),
                prisma_1.prisma.groupMember.findFirst({
                    where: { groupId: conversationId, userId },
                    select: { id: true },
                }),
            ]);
            return Boolean(roomMember || groupMember);
        }
        // Messaging events. Message creation happens through GraphQL; Socket.IO is the
        // authenticated delivery channel for saved messages and typing indicators.
        socket.on('joinRoom', async (roomId) => {
            if (typeof roomId !== 'string')
                return;
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
            var _a, _b;
            const roomId = data === null || data === void 0 ? void 0 : data.roomId;
            if (typeof roomId !== 'string' || !(await canAccessConversation(roomId)))
                return;
            socket.to(roomId).emit('typing:start', {
                roomId,
                userId,
                username: (_b = (_a = socket.data.user) === null || _a === void 0 ? void 0 : _a.username) !== null && _b !== void 0 ? _b : 'Someone',
            });
        });
        socket.on('typing:stop', async (data) => {
            var _a, _b;
            const roomId = data === null || data === void 0 ? void 0 : data.roomId;
            if (typeof roomId !== 'string' || !(await canAccessConversation(roomId)))
                return;
            socket.to(roomId).emit('typing:stop', {
                roomId,
                userId,
                username: (_b = (_a = socket.data.user) === null || _a === void 0 ? void 0 : _a.username) !== null && _b !== void 0 ? _b : 'Someone',
            });
        });
        // Presence events
        socket.on('presence:heartbeat', async () => {
            if (!userId)
                return;
            const key = `presence:${userId}`;
            const isNew = await pubClient.set(key, 'online', { EX: 30, NX: true });
            if (isNew) {
                // Just went online, notify friends
                const friends = await prisma_1.prisma.friendship.findMany({
                    where: {
                        OR: [{ requesterId: userId }, { addresseeId: userId }],
                        status: 'ACCEPTED'
                    }
                });
                const friendIds = friends.map(f => f.requesterId === userId ? f.addresseeId : f.requesterId);
                friendIds.forEach((id) => {
                    context_1.pubsub.publish(`presenceUpdated:${id}`, {
                        presenceUpdated: { userId, online: true }
                    });
                });
            }
            else {
                // Already online, just update TTL
                await pubClient.set(key, 'online', { EX: 30 });
            }
        });
        socket.on('disconnect', async () => {
            if (!userId)
                return;
            await pubClient.del(`presence:${userId}`);
            const friends = await prisma_1.prisma.friendship.findMany({
                where: {
                    OR: [{ requesterId: userId }, { addresseeId: userId }],
                    status: 'ACCEPTED'
                }
            });
            const friendIds = friends.map(f => f.requesterId === userId ? f.addresseeId : f.requesterId);
            friendIds.forEach((id) => {
                context_1.pubsub.publish(`presenceUpdated:${id}`, {
                    presenceUpdated: { userId, online: false }
                });
            });
        });
        // Video/waiting room events
        socket.on('waiting:join', async (data) => {
            const { roomId } = data;
            if (!roomId || !userId)
                return;
            try {
                const user = await prisma_1.prisma.user.findUnique({
                    where: { id: userId },
                    select: { id: true, username: true, avatarUrl: true },
                });
                if (!user)
                    return;
                // Add to Redis waiting room set
                await pubClient.sAdd(`waitingroom:${roomId}`, userId);
                // Let the host/admin know the waiting room was updated
                io.to(`videoadmin:${roomId}`).emit('waiting:joined', { roomId, user });
            }
            catch (err) {
                console.error('[Video] waiting:join handler error:', err);
            }
        });
        socket.on('waiting:leave', async (data) => {
            const { roomId } = data;
            if (!roomId || !userId)
                return;
            try {
                await pubClient.sRem(`waitingroom:${roomId}`, userId);
                io.to(`videoadmin:${roomId}`).emit('waiting:left', { roomId, userId });
            }
            catch (err) {
                console.error('[Video] waiting:leave handler error:', err);
            }
        });
        socket.on('videoadmin:join', async ({ roomId }) => {
            if (!userId || !roomId)
                return;
            try {
                const room = await prisma_1.prisma.videoRoom.findUnique({ where: { id: roomId } });
                if ((room === null || room === void 0 ? void 0 : room.createdBy) === userId) {
                    socket.join(`videoadmin:${roomId}`);
                    const waitingUserIds = await pubClient.sMembers(`waitingroom:${roomId}`);
                    const waitingUsers = waitingUserIds.length
                        ? await prisma_1.prisma.user.findMany({
                            where: { id: { in: waitingUserIds } },
                            select: { id: true, username: true, avatarUrl: true },
                        })
                        : [];
                    const waitingById = new Map(waitingUsers.map((user) => [user.id, user]));
                    const orderedWaitingUsers = waitingUserIds
                        .map((waitingUserId) => waitingById.get(waitingUserId))
                        .filter((user) => Boolean(user));
                    socket.emit('waiting:sync', { roomId, users: orderedWaitingUsers });
                }
            }
            catch (err) {
                console.error('[Video] videoadmin:join handler error:', err);
            }
        });
        socket.on('waiting:approve', async ({ roomId, participantId }) => {
            if (!userId || !roomId || !participantId)
                return;
            try {
                const room = await prisma_1.prisma.videoRoom.findUnique({ where: { id: roomId } });
                if ((room === null || room === void 0 ? void 0 : room.createdBy) !== userId)
                    return;
                await pubClient.sRem(`waitingroom:${roomId}`, participantId);
                io.to(`user:${participantId}`).emit('waiting:approved', { roomId });
                io.to(`videoadmin:${roomId}`).emit('waiting:left', { roomId, userId: participantId });
            }
            catch (err) {
                console.error('[Video] waiting:approve handler error:', err);
            }
        });
        socket.on('waiting:reject', async ({ roomId, participantId }) => {
            if (!userId || !roomId || !participantId)
                return;
            try {
                const room = await prisma_1.prisma.videoRoom.findUnique({ where: { id: roomId } });
                if ((room === null || room === void 0 ? void 0 : room.createdBy) !== userId)
                    return;
                await pubClient.sRem(`waitingroom:${roomId}`, participantId);
                io.to(`user:${participantId}`).emit('waiting:rejected', { roomId });
                io.to(`videoadmin:${roomId}`).emit('waiting:left', { roomId, userId: participantId });
            }
            catch (err) {
                console.error('[Video] waiting:reject handler error:', err);
            }
        });
        /**
         * Client emits after successfully receiving the shard blob from the server.
         * Advances status: DELIVERED → ACKNOWLEDGED.
         */
        socket.on('shard:received', async ({ roomId }) => {
            if (!userId || !roomId)
                return;
            try {
                await (0, keyDelivery_1.markShardAcknowledged)(roomId, userId);
            }
            catch (err) {
                console.error('[KeyDelivery] shard:received handler error:', err);
            }
        });
        /**
         * Client emits ONLY after successfully calling unwrapRoomKey().
         * Advances status: ACKNOWLEDGED → DECRYPTED.
         * This is the terminal success event.
         */
        socket.on('shard:decrypted', async ({ roomId }) => {
            if (!userId || !roomId)
                return;
            try {
                await (0, keyDelivery_1.markShardDecrypted)(roomId, userId);
            }
            catch (err) {
                console.error('[KeyDelivery] shard:decrypted handler error:', err);
            }
        });
        /**
         * Admin client requests to join the room admin channel for live health updates.
         * Verified against DB before joining — prevents non-admins spoofing the channel.
         */
        socket.on('admin:join', async ({ roomId }) => {
            if (!userId || !roomId)
                return;
            try {
                const membership = await prisma_1.prisma.roomMember.findUnique({
                    where: { roomId_userId: { roomId, userId } },
                });
                if ((membership === null || membership === void 0 ? void 0 : membership.role) === 'ADMIN') {
                    socket.join(`adminroom:${roomId}`);
                }
            }
            catch (err) {
                console.error('[KeyDelivery] admin:join handler error:', err);
            }
        });
        // ────────────────────────────────────────────────────────────────────────
    });
    // Next.js request handler
    server.all(/.*/, (req, res) => handle(req, res));
    const port = env_1.env.PORT;
    httpServer.listen(port, () => {
        console.log(`> Ready on http://localhost:${port}`);
    });
}
main().catch((err) => {
    console.error('Server error:', err);
    process.exit(1);
});
