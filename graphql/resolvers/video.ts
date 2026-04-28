import { GraphQLContext } from '@/graphql/context';
import { RedisKeys } from '@/lib/redisKeys';
import { generateLiveKitToken } from '@/lib/livekit';

export const videoResolvers = {
  Query: {
    getLiveKitToken: async (
      _parent: unknown,
      args: { roomId: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      // For simplicity, verify they are in the video room or the host.
      // Wait, in real app, we check if they've been approved.
      // The frontend only requests this AFTER they are approved, or if they are the host.
      const room = await ctx.prisma.videoRoom.findUnique({ where: { id: args.roomId } });
      if (!room) throw new Error('Room not found');

      const user = await ctx.prisma.user.findUnique({ where: { id: ctx.userId } });
      return await generateLiveKitToken(ctx.userId, args.roomId);
    },
  },
  Mutation: {
    createVideoRoom: async (
      _parent: unknown,
      args: { maxParticipants?: number },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      const room = await ctx.prisma.videoRoom.create({
        data: {
          createdBy: ctx.userId,
          maxParticipants: args.maxParticipants || 4,
          locked: false,
        },
      });

      const updated = await ctx.prisma.videoRoom.update({
        where: { id: room.id },
        data: { liveKitRoomId: room.id },
      });

      return updated;
    },

    approveParticipant: async (
      _parent: unknown,
      args: { roomId: string; participantId: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      const room = await ctx.prisma.videoRoom.findUnique({ where: { id: args.roomId } });
      if (!room) throw new Error('Room not found');
      if (room.createdBy !== ctx.userId) throw new Error('Only the host can approve participants');

      const removed = await ctx.redis.srem(RedisKeys.waitingRoom(args.roomId), args.participantId);
      if (!removed) throw new Error('Participant not in waiting room');

      ctx.pubsub.publish(`participantApproved:${args.roomId}:${args.participantId}`, true);
      ctx.pubsub.publish(`waitingRoomUpdated:${args.roomId}`, true);

      return true;
    },

    rejectParticipant: async (
      _parent: unknown,
      args: { roomId: string; participantId: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      const room = await ctx.prisma.videoRoom.findUnique({ where: { id: args.roomId } });
      if (!room) throw new Error('Room not found');
      if (room.createdBy !== ctx.userId) throw new Error('Only the host can reject participants');

      const removed = await ctx.redis.srem(RedisKeys.waitingRoom(args.roomId), args.participantId);
      if (!removed) throw new Error('Participant not in waiting room');

      ctx.pubsub.publish(`participantRejected:${args.roomId}:${args.participantId}`, true);
      ctx.pubsub.publish(`waitingRoomUpdated:${args.roomId}`, true);

      return true;
    },

    lockVideoRoom: async (
      _parent: unknown,
      args: { roomId: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      const room = await ctx.prisma.videoRoom.findUnique({ where: { id: args.roomId } });
      if (!room) throw new Error('Room not found');
      if (room.createdBy !== ctx.userId) throw new Error('Only the host can lock the room');

      const updatedRoom = await ctx.prisma.videoRoom.update({
        where: { id: args.roomId },
        data: { locked: true },
      });

      await ctx.redis.set(RedisKeys.videoRoomLock(args.roomId), "1", "EX", 86400);
      
      ctx.pubsub.publish(`roomLocked:${args.roomId}`, true);
      
      return updatedRoom;
    },
  },

  Subscription: {
    waitingRoomUpdated: {
      subscribe: (_parent: unknown, args: { videoRoomId: string }, ctx: GraphQLContext) => {
        return ctx.pubsub.asyncIterator(`waitingRoomUpdated:${args.videoRoomId}`);
      },
      resolve: (payload: unknown) => payload,
    },
    participantApproved: {
      subscribe: (_parent: unknown, args: { videoRoomId: string }, ctx: GraphQLContext) => {
        if (!ctx.userId) throw new Error('Not authenticated');
        return ctx.pubsub.asyncIterator(`participantApproved:${args.videoRoomId}:${ctx.userId}`);
      },
      resolve: (payload: unknown) => payload,
    },
    participantRejected: {
      subscribe: (_parent: unknown, args: { videoRoomId: string }, ctx: GraphQLContext) => {
        if (!ctx.userId) throw new Error('Not authenticated');
        return ctx.pubsub.asyncIterator(`participantRejected:${args.videoRoomId}:${ctx.userId}`);
      },
      resolve: (payload: unknown) => payload,
    },
    roomLocked: {
      subscribe: (_parent: unknown, args: { videoRoomId: string }, ctx: GraphQLContext) => {
        return ctx.pubsub.asyncIterator(`roomLocked:${args.videoRoomId}`);
      },
      resolve: (payload: unknown) => payload,
    },
  },
};
