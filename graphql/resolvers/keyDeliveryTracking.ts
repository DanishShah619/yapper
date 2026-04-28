// graphql/resolvers/keyDeliveryTracking.ts
import { GraphQLContext } from '@/graphql/context';
import { prisma } from '@/lib/prisma';
import { GraphQLError } from 'graphql';
import { getRoomKeyHealth, redeliverShard } from '@/lib/keyDelivery';
import { KeyDeliveryStatus } from '@prisma/client';
import { STALE_SHARD_THRESHOLD_MINUTES } from '@/lib/redisKeys';

// ── Helper ────────────────────────────────────────────────────────────────────

async function assertRoomAdmin(roomId: string, userId: string) {
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  if (!membership || membership.role !== 'ADMIN') {
    throw new GraphQLError('Admin access required', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

// ── Resolvers ─────────────────────────────────────────────────────────────────

export const keyDeliveryTrackingResolvers = {
  Query: {
    /**
     * Aggregated key health report for a room.
     * Admin-only. Powers the health dashboard summary bar.
     */
    roomKeyHealth: async (
      _: unknown,
      { roomId }: { roomId: string },
      context: GraphQLContext,
    ) => {
      // BUG-2 FIX: was context.user.id — context shape uses context.userId
      if (!context.userId) throw new GraphQLError('Not authenticated');
      await assertRoomAdmin(roomId, context.userId);
      return getRoomKeyHealth(roomId);
    },

    /**
     * Detailed per-member delivery status breakdown.
     * Admin-only. Powers the per-member table in the dashboard.
     */
    memberKeyDeliveryDetails: async (
      _: unknown,
      { roomId }: { roomId: string },
      context: GraphQLContext,
    ) => {
      // BUG-2 FIX: was context.user.id
      if (!context.userId) throw new GraphQLError('Not authenticated');
      await assertRoomAdmin(roomId, context.userId);

      const shards = await prisma.room_key_shards.findMany({
        where: { roomId },
        include: { user: { select: { id: true, username: true } } },
        orderBy: { deliveryStatus: 'asc' }, // stale members surface first
      });

      const now = new Date();
      const thresholdMs = STALE_SHARD_THRESHOLD_MINUTES * 60 * 1000;

      return shards.map((shard) => ({
        userId: shard.userId,
        username: shard.user.username,
        status: shard.deliveryStatus,
        createdAt: shard.createdAt.toISOString(),
        deliveredAt: shard.deliveredAt?.toISOString() ?? null,
        acknowledgedAt: shard.acknowledgedAt?.toISOString() ?? null,
        decryptedAt: shard.decryptedAt?.toISOString() ?? null,
        retryCount: shard.retryCount,
        isStale:
          (shard.deliveryStatus === KeyDeliveryStatus.PENDING ||
            shard.deliveryStatus === KeyDeliveryStatus.DELIVERED) &&
          now.getTime() - shard.createdAt.getTime() > thresholdMs,
        minutesSinceCreation: Math.round(
          (now.getTime() - shard.createdAt.getTime()) / 60000,
        ),
      }));
    },
  },

  Mutation: {
    /**
     * Admin triggers a re-delivery for a stuck member.
     * Internally increments retryCount and emits shard:redeliver via Socket.IO.
     */
    redeliverKey: async (
      _: unknown,
      { roomId, userId }: { roomId: string; userId: string },
      context: GraphQLContext,
    ) => {
      // BUG-2 FIX: was context.user.id in both assertRoomAdmin and redeliverShard
      if (!context.userId) throw new GraphQLError('Not authenticated');
      await assertRoomAdmin(roomId, context.userId);
      return redeliverShard(roomId, userId, context.userId);
    },
  },

  Subscription: {
    /**
     * Admin subscribes to live health updates for a room.
     * Fires whenever any member's status transitions.
     * NOTE: Uses Socket.IO for transport — this subscription entry is a no-op
     * placeholder so the schema compiles. Real push happens via key:health Socket.IO event.
     */
    keyHealthUpdated: {
      subscribe: () => {
        throw new GraphQLError(
          'keyHealthUpdated is delivered via Socket.IO (key:health event), not GraphQL subscriptions.',
          { extensions: { code: 'NOT_IMPLEMENTED' } },
        );
      },
    },
  },
};
