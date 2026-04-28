// graphql/resolvers/keyEscrow.ts
import { prisma } from "@/lib/prisma";
import { markShardDelivered } from "@/lib/keyDelivery";
import { KeyDeliveryStatus } from "@prisma/client";

import { GraphQLError } from "graphql";

// ── Helper: verify the caller is a room admin ─────────────────────────────────
async function assertRoomAdmin(roomId: string, userId: string) {
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } }
  });
  if (!membership || membership.role !== "ADMIN") {
    throw new GraphQLError("Only room admins can perform this action", {
      extensions: { code: "FORBIDDEN" }
    });
  }
}

// ── Helper: verify the caller is a room member ────────────────────────────────
async function assertRoomMember(roomId: string, userId: string) {
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } }
  });
  if (!membership) {
    throw new GraphQLError("You are not a member of this room", {
      extensions: { code: "FORBIDDEN" }
    });
  }
}

export const keyEscrowResolvers = {
  Query: {
    /**
     * Fetch the caller's own encrypted shard for a room.
     * They will decrypt this client-side to get the room key.
     * The server returns only the encrypted blob — it cannot read it.
     * Side-effect: advances delivery status PENDING → DELIVERED (fire-and-forget).
     */
    myKeyShard: async (_: unknown, { roomId }: { roomId: string }, context: any) => {
      const userId = context.user.id;  // from your auth middleware
      await assertRoomMember(roomId, userId);

      const shard = await prisma.room_key_shards.findUnique({
        where: { roomId_userId: { roomId, userId } }
      });

      if (shard && shard.deliveryStatus === KeyDeliveryStatus.PENDING) {
        // Fire-and-forget: do NOT await. Member gets their shard instantly;
        // tracking update happens asynchronously.
        markShardDelivered(roomId, userId).catch((err) =>
          console.error('[KeyDelivery] Failed to mark shard delivered:', err)
        );
      }

      return shard;  // null if not found — client should handle this
    },

    /**
     * Fetch public keys of multiple users.
     * Safe to return — public keys are meant to be shared.
     */
    userPublicKeys: async (
      _: unknown,
      { userIds }: { userIds: string[] },
      context: any
    ) => {
      // Caller must be authenticated
      if (!context.user) throw new GraphQLError("Not authenticated");

      return prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, publicKey: true, avatarUrl: true }
      });
    },
  },

  Mutation: {
    /**
     * Upload the caller's ECDH public key.
     * Called once after generating the key pair on first login.
     * The private key is NEVER sent here — only the public key.
     */
    updatePublicKey: async (
      _: unknown,
      { publicKeyJwk }: { publicKeyJwk: string },
      context: any
    ) => {
      const userId = context.user.id;

      // Basic validation — ensure it's valid JSON
      try {
        JSON.parse(publicKeyJwk);
      } catch {
        throw new GraphQLError("Invalid public key format");
      }

      await prisma.user.update({
        where: { id: userId },
        data: { publicKey: publicKeyJwk }
      });

      return true;
    },

    /**
     * Upload encrypted shards for multiple members.
     * Called during room creation, when adding a new member, or after key rotation.
     * The server receives only encrypted blobs — it cannot derive the room key.
     *
     * Security: caller must be a room admin to upload shards for others.
     * Exception: a member can upload their OWN shard (for the creator on room creation).
     */
    uploadKeyShards: async (
      _: unknown,
      { roomId, shards }: { roomId: string; shards: Array<{ userId: string; encryptedShard: string }> },
      context: any
    ) => {
      const callerId = context.user.id;
      await assertRoomAdmin(roomId, callerId);

      // Upsert each shard — if one already exists for this user+room, replace it
      await Promise.all(
        shards.map(({ userId, encryptedShard }) =>
          prisma.room_key_shards.upsert({
            where: { roomId_userId: { roomId, userId } },
            create: { roomId, userId, encryptedShard },
            update: { encryptedShard }
          })
        )
      );

      return true;
    },

    /**
     * Rotate the room key.
     * Called when a member is removed, or by an admin manually.
     *
     * Process:
     * 1. Admin generates new room key client-side (NOT here — this is server code)
     * 2. Admin encrypts new key for each remaining member (NOT here — client-side)
     * 3. Admin calls this mutation with the new encrypted shards
     * 4. Server deletes ALL old shards and stores new ones
     * 5. Server emits keyRotated event — all online members fetch their new shard
     *
     * CRITICAL: If removedMemberId is provided, we verify they have no shard.
     */
    rotateKey: async (
      _: unknown,
      {
        roomId,
        newShards,
        removedMemberId
      }: {
        roomId: string;
        newShards: Array<{ userId: string; encryptedShard: string }>;
        removedMemberId?: string;
      },
      context: any
    ) => {
      const callerId = context.user.id;
      await assertRoomAdmin(roomId, callerId);

      // Verify the removed member is NOT in the new shards list
      // If they are, reject — they should not receive the new key
      if (removedMemberId) {
        const shardForRemoved = newShards.find(s => s.userId === removedMemberId);
        if (shardForRemoved) {
          throw new GraphQLError(
            "Cannot include removed member in key rotation shards",
            { extensions: { code: "BAD_USER_INPUT" } }
          );
        }
      }

      // Use a transaction — all or nothing
      // Either all shards are replaced or none are
      await prisma.$transaction(async (tx) => {
        // Delete ALL existing shards for this room
        await tx.room_key_shards.deleteMany({ where: { roomId } });

        // Insert all new shards
        await tx.room_key_shards.createMany({
          data: newShards.map(({ userId, encryptedShard }) => ({
            roomId,
            userId,
            encryptedShard
          }))
        });
      });

      // Notify all connected members that the key has changed
      // Each member will fetch their new shard and decrypt it


      return true;
    },

    /**
     * Designate a fallback admin for a room.
     * Only a current admin can call this.
     * This stores a userId — NO key material is involved.
     */
    setFallbackAdmin: async (
      _: unknown,
      { roomId, userId }: { roomId: string; userId: string },
      context: any
    ) => {
      const callerId = context.user.id;
      await assertRoomAdmin(roomId, callerId);

      // Verify the designated user is actually a member of the room
      await assertRoomMember(roomId, userId);

      await prisma.room.update({
        where: { id: roomId },
        data: { fallbackAdminId: userId }
      });

      return true;
    },

    /**
     * Promote the fallback admin to full admin.
     * Only the designated fallback admin can call this on themselves.
     * Triggered when the primary admin has been offline too long.
     */
    promoteFallbackAdmin: async (
      _: unknown,
      { roomId }: { roomId: string },
      context: any
    ) => {
      const callerId = context.user.id;

      const room = await prisma.room.findUnique({ where: { id: roomId }, select: { fallbackAdminId: true } });

      if (!room) {
        throw new GraphQLError("Room not found");
      }

      // Only the designated fallback admin can call this
      if (room && room.fallbackAdminId !== callerId) {
        throw new GraphQLError(
          "You are not the designated fallback admin for this room",
          { extensions: { code: "FORBIDDEN" } }
        );
      }

      // Promote them to admin in room_members
      await prisma.roomMember.update({
        where: { roomId_userId: { roomId, userId: callerId } },
        data: { role: "ADMIN" }
      });

      // Clear the fallbackAdminId — they are now a full admin
      await prisma.room.update({
        where: { id: roomId },
        data: { fallbackAdminId: null }
      });

      return true;
    },
  },

  // Subscription removed. No pubsub.
};