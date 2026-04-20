import { GraphQLContext } from '@/graphql/context';

// Stub resolvers for features not yet implemented or delegated to other resolver files.
// Group mutations and subscription live in groups.ts.
// Auth mutations live in auth.ts. User queries live in user.ts.
export const stubResolvers = {
  Mutation: {
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
