import { GraphQLContext } from '@/graphql/context';

// Stub mutation resolvers for features implemented in later phases.
// Each validates auth and throws a "not yet implemented" error.
export const stubResolvers = {
  Mutation: {
    // Phase 2: Social Graph
    sendConnectionRequest: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 2');
    },
    respondToConnectionRequest: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 2');
    },
    removeConnection: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 2');
    },

    // Phase 3: Messaging
    createRoom: async (
      _parent: unknown,
      args: { name?: string; type?: string; memberIds: string[] },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      // Create room
      const room = await ctx.prisma.room.create({
        data: {
          name: args.name || null,
          type: args.type || 'PERSISTENT',
          createdBy: ctx.userId,
        },
      });

      // Add members
      const memberIds = Array.from(new Set([ctx.userId, ...args.memberIds]));
      await Promise.all(
        memberIds.map((userId) =>
          ctx.prisma.roomMember.create({
            data: {
              roomId: room.id,
              userId,
              role: userId === ctx.userId ? 'ADMIN' : 'MEMBER',
            },
          })
        )
      );

      return {
        id: room.id,
        name: room.name,
        type: room.type,
        createdBy: ctx.userId,
        locked: room.locked,
        createdAt: room.createdAt,
      };
    },
    inviteToRoom: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 3');
    },
    generateInviteLink: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 3');
    },
    sendMessage: async (
      _parent: unknown,
      args: { roomId: string; encryptedPayload: string; ephemeral?: boolean; expiresAt?: Date },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      // Validate room
      const room = await ctx.prisma.room.findUnique({ where: { id: args.roomId } });
      if (!room) throw new Error('Room not found');

      // Validate membership
      const member = await ctx.prisma.roomMember.findFirst({ where: { roomId: args.roomId, userId: ctx.userId } });
      if (!member) throw new Error('Not a member of this room');

      // Create message
      const message = await ctx.prisma.message.create({
        data: {
          roomId: args.roomId,
          senderId: ctx.userId,
          encryptedPayload: args.encryptedPayload,
          ephemeral: !!args.ephemeral,
          expiresAt: args.expiresAt || null,
        },
        include: {
          sender: true,
        },
      });

      return {
        id: message.id,
        roomId: message.roomId,
        sender: message.sender,
        encryptedPayload: message.encryptedPayload,
        ephemeral: message.ephemeral,
        expiresAt: message.expiresAt,
        createdAt: message.createdAt,
      };
    },
    uploadFile: async (
      _parent: unknown,
      args: { roomId: string; encryptedMetadata: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      // Validate room
      const room = await ctx.prisma.room.findUnique({ where: { id: args.roomId } });
      if (!room) throw new Error('Room not found');

      // Validate membership
      const member = await ctx.prisma.roomMember.findFirst({ where: { roomId: args.roomId, userId: ctx.userId } });
      if (!member) throw new Error('Not a member of this room');

      // Create file record
      const file = await ctx.prisma.file.create({
        data: {
          roomId: args.roomId,
          uploaderId: ctx.userId,
          encryptedMetadata: args.encryptedMetadata,
        },
        include: {
          uploader: true,
        },
      });

      return {
        id: file.id,
        roomId: file.roomId,
        uploader: file.uploader,
        encryptedMetadata: file.encryptedMetadata,
        createdAt: file.createdAt,
      };
    },

    // Phase 4: Video
    createVideoRoom: async (
      _parent: unknown,
      args: { maxParticipants?: number },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      const LiveKitServer = require('livekit-server-sdk');
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      const liveKit = new LiveKitServer.RoomServiceClient('http://localhost:7880', apiKey, apiSecret);

      // Create LiveKit room
      const roomOptions = {
        name: `room-${Date.now()}`,
        maxParticipants: args.maxParticipants || 4,
        e2ee: true,
      };
      await liveKit.createRoom(roomOptions);

      // Store in DB
      const videoRoom = await ctx.prisma.videoRoom.create({
        data: {
          liveKitRoomId: roomOptions.name,
          createdBy: ctx.userId,
          locked: false,
          maxParticipants: roomOptions.maxParticipants,
        },
      });

      return {
        id: videoRoom.id,
        liveKitRoomId: videoRoom.liveKitRoomId,
        createdBy: videoRoom.createdBy,
        locked: videoRoom.locked,
        maxParticipants: videoRoom.maxParticipants,
        createdAt: videoRoom.createdAt,
      };
    },
    approveParticipant: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 4');
    },
    rejectParticipant: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 4');
    },
    lockVideoRoom: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 4');
    },

    // Phase 5: Groups
    createGroup: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 5');
    },
    addGroupMember: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 5');
    },
    removeGroupMember: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 5');
    },
    promoteGroupMember: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 5');
    },
    transferGroupOwnership: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 5');
    },
    lockGroup: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 5');
    },
    deleteGroup: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 5');
    },
    muteGroupMember: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 5');
    },

    // V2: Social Feed
    createPost: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — V2');
    },
  },
};
