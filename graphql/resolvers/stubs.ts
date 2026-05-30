import { GraphQLContext } from '@/graphql/context';

const MAX_ENCRYPTED_FILE_BYTES = 105 * 1024 * 1024;

// Stub resolvers for features not yet implemented or delegated to other resolver files.
// Group mutations and subscription live in groups.ts.
// Auth mutations live in auth.ts. User queries live in user.ts.
export const stubResolvers = {
  // ─── V2 Stubs ─────────────────────────────────────────────
  Query: {
    // peopleYouMayKnow: Returns empty array, see userResolvers for implementation plan.
    peopleYouMayKnow: async () => [],
    // feed: Returns empty array, see userResolvers for implementation plan.
    feed: async () => [],
  },
  Mutation: {
    // createPost: Returns a stub Post object. See PRD FR-14 for V2 implementation plan.
    createPost: async (_parent: unknown, args: { content: string }, context: GraphQLContext) => {
      if (!context.userId) throw new Error('Not authenticated');
      // TODO (V2): Implement post creation and feed delivery.
      return {
        id: 'stub',
        userId: context.userId,
        content: args.content,
        createdAt: new Date().toISOString(),
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
      if (room.locked) throw new Error('ROOM_LOCKED');

      const member = await ctx.prisma.roomMember.findFirst({
        where: { roomId: args.roomId, userId: ctx.userId },
      });
      if (!member) throw new Error('Not a member of this room');
      if (member.mutedAt) throw new Error('MEMBER_MUTED');

      const encryptedBlob = Buffer.from(args.encryptedBlob, 'base64');
      if (encryptedBlob.byteLength > MAX_ENCRYPTED_FILE_BYTES) {
        throw new Error('File is too large');
      }

      const file = await ctx.prisma.file.create({
        data: {
          roomId: args.roomId,
          uploaderId: ctx.userId,
          encryptedBlob,
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
    // Video mutations (createVideoRoom, approveParticipant, rejectParticipant,
    // lockVideoRoom) are fully implemented in graphql/resolvers/video.ts.
    // Stubs removed — video.ts is spread after this file in resolvers/index.ts
    // so it always wins. No dead throwing stubs needed.
  },
};
