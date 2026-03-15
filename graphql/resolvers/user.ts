import prisma from '@/lib/prisma';
import { GraphQLContext } from '@/graphql/context';

export const userResolvers = {
  Query: {
    me: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      if (!context.userId) {
        throw new Error('Not authenticated');
      }

      const user = await prisma.user.findUnique({
        where: { id: context.userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      };
    },

    user: async (
      _parent: unknown,
      args: { username: string },
      context: GraphQLContext
    ) => {
      if (!context.userId) {
        throw new Error('Not authenticated');
      }

      const user = await prisma.user.findUnique({
        where: { username: args.username.toLowerCase() },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      };
    },

    // ─── Stub resolvers (implemented in later phases) ───
    connections: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');
      // TODO: Phase 2 — Return accepted connections
      return [];
    },

    connectionRequests: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');
      // TODO: Phase 2 — Return pending incoming requests
      return [];
    },

    conversations: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');
      // TODO: Phase 3 — Return all conversations
      return [];
    },

    conversation: async (
      _parent: unknown,
      _args: { id: string },
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');
      // TODO: Phase 3
      return null;
    },

    messages: async (
      _parent: unknown,
      _args: { roomId: string; cursor?: string; limit?: number },
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');
      // TODO: Phase 3 — Cursor-based pagination
      return { edges: [], pageInfo: { hasNextPage: false, endCursor: null } };
    },

    group: async (
      _parent: unknown,
      _args: { id: string },
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');
      // TODO: Phase 5
      return null;
    },

    groups: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');
      // TODO: Phase 5
      return [];
    },

    // ─── V2 Stubs ───
    peopleYouMayKnow: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');
      // TODO: V2 — Algorithm: surface users with 2+ mutual connections
      return [];
    },

    feed: async (
      _parent: unknown,
      _args: { cursor?: string; limit?: number },
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');
      // TODO: V2 — Feed from connected users, reverse-chronological
      return [];
    },
  },
};
