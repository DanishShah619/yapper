import { GraphQLContext } from '@/graphql/context';

// Stub resolvers for features not yet implemented or delegated to other resolver files.
// Group mutations and subscription live in groups.ts.
// Auth mutations live in auth.ts. User queries live in user.ts.
export const stubResolvers = {
  Mutation: {
    // ─── Phase 2: Social Graph (not implemented yet) ─────────────────
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

    // ─── Phase 3: Rooms ───────────────────────────────────────────────
    createRoom: async (
      _parent: unknown,
      args: { name: string; type: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      const room = await ctx.prisma.room.create({
        data: {
          name: args.name || null,
          type: (args.type || 'PERSISTENT') as 'PERSISTENT' | 'EPHEMERAL',
          createdBy: ctx.userId,
        },
      });

      await ctx.prisma.roomMember.create({
        data: { roomId: room.id, userId: ctx.userId, role: 'ADMIN' },
      });

      return {
        id: room.id,
        name: room.name,
        type: room.type,
        locked: room.locked,
        members: [],
        createdAt: room.createdAt,
      };
    },

    inviteToRoom: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 3');
    },

    // ─── Phase 3: Messages ────────────────────────────────────────────
    sendMessage: async (
      _parent: unknown,
      args: { roomId?: string; encryptedPayload: string; ephemeral?: boolean; expiresAt?: Date },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      if (!args.roomId) throw new Error('roomId is required (group messages use groupId — call sendGroupMessage)');

      // Validate room
      const room = await ctx.prisma.room.findUnique({ where: { id: args.roomId } });
      if (!room) throw new Error('Room not found');

      // Validate room membership
      const member = await ctx.prisma.roomMember.findFirst({
        where: { roomId: args.roomId, userId: ctx.userId },
      });
      if (!member) throw new Error('Not a member of this room');

      // Ephemeral room overrides per-message flag
      const ephemeral = room.type === 'EPHEMERAL' ? true : !!args.ephemeral;

      const message = await ctx.prisma.message.create({
        data: {
          roomId: args.roomId,
          senderId: ctx.userId,
          encryptedPayload: args.encryptedPayload,
          ephemeral,
          expiresAt: args.expiresAt || null,
        },
        include: { sender: true },
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

    // ─── Phase 3: Files ───────────────────────────────────────────────
    uploadFile: async (
      _parent: unknown,
      args: { roomId: string; encryptedBlob: string; encryptedMetadata: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      const room = await ctx.prisma.room.findUnique({ where: { id: args.roomId } });
      if (!room) throw new Error('Room not found');

      const member = await ctx.prisma.roomMember.findFirst({
        where: { roomId: args.roomId, userId: ctx.userId },
      });
      if (!member) throw new Error('Not a member of this room');

      const file = await ctx.prisma.file.create({
        data: {
          roomId: args.roomId,
          uploaderId: ctx.userId,
          encryptedBlob: Buffer.from(args.encryptedBlob, 'base64'),
          encryptedMetadata: args.encryptedMetadata,
        },
        include: { uploader: true },
      });

      return {
        id: file.id,
        roomId: file.roomId,
        uploader: file.uploader,
        encryptedMetadata: file.encryptedMetadata,
        createdAt: file.createdAt,
      };
    },

    // ─── Phase 4: Video ───────────────────────────────────────────────
    createVideoRoom: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 4');
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

    // ─── V2 Stubs ─────────────────────────────────────────────────────
    createPost: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — V2');
    },
  },


  
};
