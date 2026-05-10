// lib/keyDelivery.ts
// ─────────────────────────────────────────────────────────────────────────────
// Key Delivery Tracking — Status Transition Engine
//
// This file owns ALL status transitions for room_key_shards.deliveryStatus.
// Every transition updates BOTH PostgreSQL (source of truth) AND Redis (cache).
// Never update deliveryStatus directly in resolvers — always call these functions.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from './prisma';
import { redis } from './redis';
import { getIO } from './socketIO';
import { RedisKeys, STALE_SHARD_THRESHOLD_MINUTES, MAX_REDELIVERY_ATTEMPTS } from './redisKeys';
import { KeyDeliveryStatus } from '@prisma/client';

// ── TYPE DEFINITIONS ──────────────────────────────────────────────────────────

export interface KeyHealthReport {
  roomId: string;
  totalMembers: number;
  pending: number;
  delivered: number;
  acknowledged: number;
  decrypted: number;
  healthScore: number;      // 0-100: percentage of members with DECRYPTED status
  staleMembers: string[];   // userIds stuck in PENDING/DELIVERED > threshold
  isHealthy: boolean;       // true if all members are DECRYPTED
}

export interface MemberDeliveryDetail {
  userId: string;
  username: string;
  status: KeyDeliveryStatus;
  createdAt: Date;
  deliveredAt: Date | null;
  acknowledgedAt: Date | null;
  decryptedAt: Date | null;
  retryCount: number;
  isStale: boolean;
  minutesSinceCreation: number;
}

// ── STATUS TRANSITIONS ────────────────────────────────────────────────────────

/**
 * PENDING → DELIVERED
 * Called when a member's client fetches their shard via the myKeyShard query.
 * Only advances if the current status is PENDING — never moves status backward.
 */
export async function markShardDelivered(roomId: string, userId: string): Promise<void> {
  const now = new Date();

  await prisma.room_key_shards.update({
    where: { roomId_userId: { roomId, userId } },
    data: {
      deliveryStatus: KeyDeliveryStatus.DELIVERED,
      deliveredAt: now,
    },
  });

  await redis.setex(RedisKeys.keyDeliveryStatus(roomId, userId), 86400, KeyDeliveryStatus.DELIVERED);
  await redis.srem(RedisKeys.staleShards(roomId), userId);
  await redis.del(RedisKeys.keyHealthScore(roomId));
  await pushHealthUpdateToAdmins(roomId);
}

/**
 * DELIVERED → ACKNOWLEDGED
 * Called when the client emits 'shard:received' via Socket.IO.
 * Means the client received the shard without network errors; decryption is starting.
 */
export async function markShardAcknowledged(roomId: string, userId: string): Promise<void> {
  const now = new Date();

  await prisma.room_key_shards.update({
    where: { roomId_userId: { roomId, userId } },
    data: {
      deliveryStatus: KeyDeliveryStatus.ACKNOWLEDGED,
      acknowledgedAt: now,
    },
  });

  await redis.setex(RedisKeys.keyDeliveryStatus(roomId, userId), 86400, KeyDeliveryStatus.ACKNOWLEDGED);
  await redis.del(RedisKeys.keyHealthScore(roomId));
  await pushHealthUpdateToAdmins(roomId);
}

/**
 * ACKNOWLEDGED → DECRYPTED
 * Called when the client emits 'shard:decrypted' via Socket.IO.
 * This is the terminal success state — member now has a working room key.
 */
export async function markShardDecrypted(roomId: string, userId: string): Promise<void> {
  const now = new Date();

  await prisma.room_key_shards.update({
    where: { roomId_userId: { roomId, userId } },
    data: {
      deliveryStatus: KeyDeliveryStatus.DECRYPTED,
      decryptedAt: now,
    },
  });

  await redis.setex(RedisKeys.keyDeliveryStatus(roomId, userId), 86400, KeyDeliveryStatus.DECRYPTED);
  await redis.srem(RedisKeys.staleShards(roomId), userId);
  await redis.del(RedisKeys.keyHealthScore(roomId));
  await pushHealthUpdateToAdmins(roomId);
}

// ── HEALTH CALCULATION ────────────────────────────────────────────────────────

/**
 * Calculate the key health report for a room.
 * Primary data source for the admin dashboard.
 * Health score is cached in Redis for 30s; full detail always comes from DB.
 */
export async function getRoomKeyHealth(roomId: string): Promise<KeyHealthReport> {
  const shards = await prisma.room_key_shards.findMany({
    where: { roomId },
    include: { user: { select: { id: true, username: true } } },
  });

  const now = new Date();
  const thresholdMs = STALE_SHARD_THRESHOLD_MINUTES * 60 * 1000;

  const counts = { pending: 0, delivered: 0, acknowledged: 0, decrypted: 0 };
  const staleMembers: string[] = [];

  for (const shard of shards) {
    const key = shard.deliveryStatus.toLowerCase() as keyof typeof counts;
    counts[key]++;

    const isStale =
      (shard.deliveryStatus === KeyDeliveryStatus.PENDING ||
        shard.deliveryStatus === KeyDeliveryStatus.DELIVERED) &&
      now.getTime() - shard.createdAt.getTime() > thresholdMs;

    if (isStale) staleMembers.push(shard.userId);
  }

  const totalMembers = shards.length;
  const healthScore =
    totalMembers === 0 ? 100 : Math.round((counts.decrypted / totalMembers) * 100);

  // Cache health score for 30 seconds
  await redis.setex(RedisKeys.keyHealthScore(roomId), 30, healthScore.toString());

  // Update stale set in Redis
  await redis.del(RedisKeys.staleShards(roomId));
  if (staleMembers.length > 0) {
    await redis.sadd(RedisKeys.staleShards(roomId), ...staleMembers);
    await redis.expire(RedisKeys.staleShards(roomId), 3600);
  }

  return {
    roomId,
    totalMembers,
    ...counts,
    healthScore,
    staleMembers,
    isHealthy: counts.decrypted === totalMembers && totalMembers > 0,
  };
}

// ── STALE DETECTION ───────────────────────────────────────────────────────────

/**
 * Scan all rooms for stale shards and alert admins via Socket.IO.
 * Called exclusively by the background worker — never in a request handler.
 */
export async function detectAndAlertStaleShards(): Promise<void> {
  const cutoffTime = new Date(Date.now() - STALE_SHARD_THRESHOLD_MINUTES * 60 * 1000);

  const staleShards = await prisma.room_key_shards.findMany({
    where: {
      deliveryStatus: { in: [KeyDeliveryStatus.PENDING, KeyDeliveryStatus.DELIVERED] },
      createdAt: { lt: cutoffTime },
      retryCount: { lt: MAX_REDELIVERY_ATTEMPTS },
    },
    include: {
      room: { select: { id: true, createdBy: true, fallbackAdminId: true } },
      user: { select: { id: true, username: true } },
    },
  });

  // Group by room to emit one alert per room, not one per shard
  const byRoom = new Map<string, typeof staleShards>();
  for (const shard of staleShards) {
    const existing = byRoom.get(shard.roomId) ?? [];
    existing.push(shard);
    byRoom.set(shard.roomId, existing);
  }

  let io;
  try {
    io = getIO();
  } catch {
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
export async function redeliverShard(
  roomId: string,
  userId: string,
  requestedBy: string,
): Promise<{ success: boolean; reason?: string }> {
  const lockKey = RedisKeys.redeliveryLock(roomId, userId);

  // SET NX EX — atomic: only one process can acquire the lock
  const lockAcquired = await redis.set(lockKey, requestedBy, 'EX', 30, 'NX');
  if (!lockAcquired) {
    return { success: false, reason: 'Re-delivery already in progress for this member' };
  }

  try {
    const shard = await prisma.room_key_shards.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!shard) return { success: false, reason: 'No shard found for this member' };
    if (shard.deliveryStatus === KeyDeliveryStatus.DECRYPTED) {
      return { success: false, reason: 'Member already has the key' };
    }
    if (shard.retryCount >= MAX_REDELIVERY_ATTEMPTS) {
      return {
        success: false,
        reason: `Maximum re-delivery attempts (${MAX_REDELIVERY_ATTEMPTS}) reached. Key rotation required.`,
      };
    }

    // Reset to PENDING and increment retry counter
    await prisma.room_key_shards.update({
      where: { roomId_userId: { roomId, userId } },
      data: {
        deliveryStatus: KeyDeliveryStatus.PENDING,
        deliveredAt: null,
        acknowledgedAt: null,
        decryptedAt: null,
        retryCount: { increment: 1 },
        lastRetryAt: new Date(),
      },
    });

    await redis.setex(RedisKeys.keyDeliveryStatus(roomId, userId), 86400, KeyDeliveryStatus.PENDING);

    // Notify the member to re-fetch (if online; silently skipped if offline)
    try {
      getIO().to(`user:${userId}`).emit('shard:redeliver', {
        roomId,
        message: 'Your room key has been re-sent. Refreshing...',
      });
    } catch {
      // Socket.IO not available — not fatal, member will pick it up on next login
    }

    await redis.del(RedisKeys.keyHealthScore(roomId));
    await pushHealthUpdateToAdmins(roomId);

    return { success: true };
  } finally {
    // Always release the lock, even on errors
    await redis.del(lockKey);
  }
}

// ── INTERNAL HELPERS ──────────────────────────────────────────────────────────

/**
 * Push a live key health update to all admins of a room.
 * Called after every status transition so the dashboard updates in real-time.
 */
async function pushHealthUpdateToAdmins(roomId: string): Promise<void> {
  let io;
  try {
    io = getIO();
  } catch {
    return; // Socket.IO not initialised — skip
  }

  const health = await getRoomKeyHealth(roomId);

  const admins = await prisma.roomMember.findMany({
    where: { roomId, role: 'ADMIN' },
    select: { userId: true },
  });

  for (const admin of admins) {
    io.to(`admin:${admin.userId}`).emit('key:health', health);
  }
}
