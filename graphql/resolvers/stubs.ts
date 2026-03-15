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
    createRoom: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 3');
    },
    inviteToRoom: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 3');
    },
    generateInviteLink: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 3');
    },
    sendMessage: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 3');
    },
    uploadFile: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      throw new Error('Not yet implemented — Phase 3');
    },

    // Phase 4: Video
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
