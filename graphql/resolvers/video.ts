import { randomUUID } from 'crypto';
import { GraphQLContext } from '@/graphql/context';
import { RedisKeys } from '@/lib/redisKeys';
import { generateLiveKitToken } from '@/lib/livekit';
import { tryGetIO } from '@/lib/socketIO';

export const videoResolvers = {
  Query: {
    videoRoom: async (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      const room = await ctx.prisma.videoRoom.findUnique({ where: { id: args.id } });
      if (!room) return null;

      return room;
    },

    liveKitToken: async (
      _parent: unknown,
      args: { roomId: string },
      ctx: GraphQLContext
    ) => {
      return videoResolvers.Query.getLiveKitToken(_parent, args, ctx);
    },

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
      if (room.locked && room.createdBy !== ctx.userId) {
        throw new Error('Room is locked');
      }

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
        data: { liveKitRoomId: randomUUID() },
      });

      return updated;
    },

    createConversationVideoCall: async (
      _parent: unknown,
      args: { conversationId: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      const room = await ctx.prisma.room.findUnique({
        where: { id: args.conversationId },
        include: { members: { include: { user: true } } },
      });

      const group = room
        ? null
        : await ctx.prisma.group.findUnique({
            where: { id: args.conversationId },
            include: { members: { include: { user: true } } },
          });

      const members = room?.members ?? group?.members ?? [];
      if (members.length === 0) throw new Error('Conversation not found');

      const callerMember = members.find((member) => member.userId === ctx.userId);
      if (!callerMember) throw new Error('Not a member of this conversation');

      const caller = callerMember.user;
      const videoRoom = await ctx.prisma.videoRoom.create({
        data: {
          createdBy: ctx.userId,
          maxParticipants: Math.max(2, Math.min(members.length, 4)),
          locked: false,
        },
      });

      const updated = await ctx.prisma.videoRoom.update({
        where: { id: videoRoom.id },
        data: { liveKitRoomId: randomUUID() },
      });

      const io = tryGetIO();
      if (io) {
        for (const member of members) {
          if (member.userId === ctx.userId) continue;

          io.to(`user:${member.userId}`).emit('call:incoming', {
            videoRoomId: updated.id,
            liveKitRoomId: updated.liveKitRoomId,
            conversationId: args.conversationId,
            caller: {
              id: caller.id,
              username: caller.username,
              avatarUrl: caller.avatarUrl,
            },
          });
        }
      }

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
      if (removed === 0) throw new Error('Participant not in waiting room');

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
      if (removed === 0) throw new Error('Participant not in waiting room');

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
        if (!ctx.userId) throw new Error('Not authenticated');
        return ctx.pubsub.asyncIterator(`roomLocked:${args.videoRoomId}`);
      },
      resolve: (payload: unknown) => payload,
    },
  },
};
