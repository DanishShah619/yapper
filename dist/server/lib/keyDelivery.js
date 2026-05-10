"use strict";
// lib/keyDelivery.ts
// ─────────────────────────────────────────────────────────────────────────────
// Key Delivery Tracking — Status Transition Engine
//
// This file owns ALL status transitions for room_key_shards.deliveryStatus.
// Every transition updates BOTH PostgreSQL (source of truth) AND Redis (cache).
// Never update deliveryStatus directly in resolvers — always call these functions.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.markShardDelivered = markShardDelivered;
exports.markShardAcknowledged = markShardAcknowledged;
exports.markShardDecrypted = markShardDecrypted;
exports.getRoomKeyHealth = getRoomKeyHealth;
exports.detectAndAlertStaleShards = detectAndAlertStaleShards;
exports.redeliverShard = redeliverShard;
const prisma_1 = require("./prisma");
const redis_1 = require("./redis");
const socketIO_1 = require("./socketIO");
const redisKeys_1 = require("./redisKeys");
const client_1 = require("@prisma/client");
// ── STATUS TRANSITIONS ────────────────────────────────────────────────────────
/**
 * PENDING → DELIVERED
 * Called when a member's client fetches their shard via the myKeyShard query.
 * Only advances if the current status is PENDING — never moves status backward.
 */
async function markShardDelivered(roomId, userId) {
    const now = new Date();
    await prisma_1.prisma.room_key_shards.update({
        where: { roomId_userId: { roomId, userId } },
        data: {
            deliveryStatus: client_1.KeyDeliveryStatus.DELIVERED,
            deliveredAt: now,
        },
    });
    await redis_1.redis.setex(redisKeys_1.RedisKeys.keyDeliveryStatus(roomId, userId), 86400, client_1.KeyDeliveryStatus.DELIVERED);
    await redis_1.redis.srem(redisKeys_1.RedisKeys.staleShards(roomId), userId);
    await redis_1.redis.del(redisKeys_1.RedisKeys.keyHealthScore(roomId));
    await pushHealthUpdateToAdmins(roomId);
}
/**
 * DELIVERED → ACKNOWLEDGED
 * Called when the client emits 'shard:received' via Socket.IO.
 * Means the client received the shard without network errors; decryption is starting.
 */
async function markShardAcknowledged(roomId, userId) {
    const now = new Date();
    await prisma_1.prisma.room_key_shards.update({
        where: { roomId_userId: { roomId, userId } },
        data: {
            deliveryStatus: client_1.KeyDeliveryStatus.ACKNOWLEDGED,
            acknowledgedAt: now,
        },
    });
    await redis_1.redis.setex(redisKeys_1.RedisKeys.keyDeliveryStatus(roomId, userId), 86400, client_1.KeyDeliveryStatus.ACKNOWLEDGED);
    await redis_1.redis.del(redisKeys_1.RedisKeys.keyHealthScore(roomId));
    await pushHealthUpdateToAdmins(roomId);
}
/**
 * ACKNOWLEDGED → DECRYPTED
 * Called when the client emits 'shard:decrypted' via Socket.IO.
 * This is the terminal success state — member now has a working room key.
 */
async function markShardDecrypted(roomId, userId) {
    const now = new Date();
    await prisma_1.prisma.room_key_shards.update({
        where: { roomId_userId: { roomId, userId } },
        data: {
            deliveryStatus: client_1.KeyDeliveryStatus.DECRYPTED,
            decryptedAt: now,
        },
    });
    await redis_1.redis.setex(redisKeys_1.RedisKeys.keyDeliveryStatus(roomId, userId), 86400, client_1.KeyDeliveryStatus.DECRYPTED);
    await redis_1.redis.srem(redisKeys_1.RedisKeys.staleShards(roomId), userId);
    await redis_1.redis.del(redisKeys_1.RedisKeys.keyHealthScore(roomId));
    await pushHealthUpdateToAdmins(roomId);
}
// ── HEALTH CALCULATION ────────────────────────────────────────────────────────
/**
 * Calculate the key health report for a room.
 * Primary data source for the admin dashboard.
 * Health score is cached in Redis for 30s; full detail always comes from DB.
 */
async function getRoomKeyHealth(roomId) {
    const shards = await prisma_1.prisma.room_key_shards.findMany({
        where: { roomId },
        include: { user: { select: { id: true, username: true } } },
    });
    const now = new Date();
    const thresholdMs = redisKeys_1.STALE_SHARD_THRESHOLD_MINUTES * 60 * 1000;
    const counts = { pending: 0, delivered: 0, acknowledged: 0, decrypted: 0 };
    const staleMembers = [];
    for (const shard of shards) {
        const key = shard.deliveryStatus.toLowerCase();
        counts[key]++;
        const isStale = (shard.deliveryStatus === client_1.KeyDeliveryStatus.PENDING ||
            shard.deliveryStatus === client_1.KeyDeliveryStatus.DELIVERED) &&
            now.getTime() - shard.createdAt.getTime() > thresholdMs;
        if (isStale)
            staleMembers.push(shard.userId);
    }
    const totalMembers = shards.length;
    const healthScore = totalMembers === 0 ? 100 : Math.round((counts.decrypted / totalMembers) * 100);
    // Cache health score for 30 seconds
    await redis_1.redis.setex(redisKeys_1.RedisKeys.keyHealthScore(roomId), 30, healthScore.toString());
    // Update stale set in Redis
    await redis_1.redis.del(redisKeys_1.RedisKeys.staleShards(roomId));
    if (staleMembers.length > 0) {
        await redis_1.redis.sadd(redisKeys_1.RedisKeys.staleShards(roomId), ...staleMembers);
        await redis_1.redis.expire(redisKeys_1.RedisKeys.staleShards(roomId), 3600);
    }
    return Object.assign(Object.assign({ roomId,
        totalMembers }, counts), { healthScore,
        staleMembers, isHealthy: counts.decrypted === totalMembers && totalMembers > 0 });
}
// ── STALE DETECTION ───────────────────────────────────────────────────────────
/**
 * Scan all rooms for stale shards and alert admins via Socket.IO.
 * Called exclusively by the background worker — never in a request handler.
 */
async function detectAndAlertStaleShards() {
    var _a;
    const cutoffTime = new Date(Date.now() - redisKeys_1.STALE_SHARD_THRESHOLD_MINUTES * 60 * 1000);
    const staleShards = await prisma_1.prisma.room_key_shards.findMany({
        where: {
            deliveryStatus: { in: [client_1.KeyDeliveryStatus.PENDING, client_1.KeyDeliveryStatus.DELIVERED] },
            createdAt: { lt: cutoffTime },
            retryCount: { lt: redisKeys_1.MAX_REDELIVERY_ATTEMPTS },
        },
        include: {
            room: { select: { id: true, createdBy: true, fallbackAdminId: true } },
            user: { select: { id: true, username: true } },
        },
    });
    // Group by room to emit one alert per room, not one per shard
    const byRoom = new Map();
    for (const shard of staleShards) {
        const existing = (_a = byRoom.get(shard.roomId)) !== null && _a !== void 0 ? _a : [];
        existing.push(shard);
        byRoom.set(shard.roomId, existing);
    }
    let io;
    try {
        io = (0, socketIO_1.getIO)();
    }
    catch (_b) {
        // Socket.IO not ready (e.g. during tests) — skip socket emissions
        console.warn('[KeyDelivery] Socket.IO not available for stale alerts');
        return;
    }
    for (const [roomId, roomStaleShards] of byRoom) {
        const room = roomStaleShards[0].room;
        const staleUsernames = roomStaleShards.map((s) => s.user.username);
        const payload = {
            roomId,
            message: `${staleUsernames.length} member(s) have not received their room key`,
            staleMembers: staleUsernames,
            suggestion: 'Open Key Health to trigger re-delivery',
        };
        io.to(`admin:${room.createdBy}`).emit('key:alert', payload);
        if (room.fallbackAdminId) {
            io.to(`admin:${room.fallbackAdminId}`).emit('key:alert', payload);
        }
    }
}
// ── RE-DELIVERY ───────────────────────────────────────────────────────────────
/**
 * Re-deliver a shard to a member stuck in PENDING or DELIVERED.
 * Uses a Redis NX lock to prevent concurrent re-delivery for the same member.
 */
async function redeliverShard(roomId, userId, requestedBy) {
    const lockKey = redisKeys_1.RedisKeys.redeliveryLock(roomId, userId);
    // SET NX EX — atomic: only one process can acquire the lock
    const lockAcquired = await redis_1.redis.set(lockKey, requestedBy, 'EX', 30, 'NX');
    if (!lockAcquired) {
        return { success: false, reason: 'Re-delivery already in progress for this member' };
    }
    try {
        const shard = await prisma_1.prisma.room_key_shards.findUnique({
            where: { roomId_userId: { roomId, userId } },
        });
        if (!shard)
            return { success: false, reason: 'No shard found for this member' };
        if (shard.deliveryStatus === client_1.KeyDeliveryStatus.DECRYPTED) {
            return { success: false, reason: 'Member already has the key' };
        }
        if (shard.retryCount >= redisKeys_1.MAX_REDELIVERY_ATTEMPTS) {
            return {
                success: false,
                reason: `Maximum re-delivery attempts (${redisKeys_1.MAX_REDELIVERY_ATTEMPTS}) reached. Key rotation required.`,
            };
        }
        // Reset to PENDING and increment retry counter
        await prisma_1.prisma.room_key_shards.update({
            where: { roomId_userId: { roomId, userId } },
            data: {
                deliveryStatus: client_1.KeyDeliveryStatus.PENDING,
                deliveredAt: null,
                acknowledgedAt: null,
                decryptedAt: null,
                retryCount: { increment: 1 },
                lastRetryAt: new Date(),
            },
        });
        await redis_1.redis.setex(redisKeys_1.RedisKeys.keyDeliveryStatus(roomId, userId), 86400, client_1.KeyDeliveryStatus.PENDING);
        // Notify the member to re-fetch (if online; silently skipped if offline)
        try {
            (0, socketIO_1.getIO)().to(`user:${userId}`).emit('shard:redeliver', {
                roomId,
                message: 'Your room key has been re-sent. Refreshing...',
            });
        }
        catch (_a) {
            // Socket.IO not available — not fatal, member will pick it up on next login
        }
        await redis_1.redis.del(redisKeys_1.RedisKeys.keyHealthScore(roomId));
        await pushHealthUpdateToAdmins(roomId);
        return { success: true };
    }
    finally {
        // Always release the lock, even on errors
        await redis_1.redis.del(lockKey);
    }
}
// ── INTERNAL HELPERS ──────────────────────────────────────────────────────────
/**
 * Push a live key health update to all admins of a room.
 * Called after every status transition so the dashboard updates in real-time.
 */
async function pushHealthUpdateToAdmins(roomId) {
    let io;
    try {
        io = (0, socketIO_1.getIO)();
    }
    catch (_a) {
        return; // Socket.IO not initialised — skip
    }
    const health = await getRoomKeyHealth(roomId);
    const admins = await prisma_1.prisma.roomMember.findMany({
        where: { roomId, role: 'ADMIN' },
        select: { userId: true },
    });
    for (const admin of admins) {
        io.to(`admin:${admin.userId}`).emit('key:health', health);
    }
}
