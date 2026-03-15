import prisma from '@/lib/prisma';
import { GraphQLContext } from '@/graphql/context';

export const userResolvers = {
        respondToConnectionRequest: async (
          _parent: unknown,
          args: { requestId: string; accept: boolean },
          context: GraphQLContext
        ) => {
          if (!context.userId) throw new Error('Not authenticated');

          // Find the friendship request
          const friendship = await prisma.friendship.findUnique({
            where: { id: args.requestId },
            include: { requester: true, addressee: true },
          });
          if (!friendship) throw new Error('Request not found');
          if (friendship.addresseeId !== context.userId) throw new Error('Not authorized');
          if (friendship.status !== 'PENDING') throw new Error('Request already handled');

          // Update status
          const updated = await prisma.friendship.update({
            where: { id: args.requestId },
            data: { status: args.accept ? 'ACCEPTED' : 'DECLINED' },
            include: { requester: true, addressee: true },
          });

          return {
            id: updated.id,
            requester: updated.requester,
            addressee: updated.addressee,
            status: updated.status,
            createdAt: updated.createdAt,
          };
        },
    Mutation: {
      sendConnectionRequest: async (
        _parent: unknown,
        args: { username: string },
        context: GraphQLContext
      ) => {
        if (!context.userId) throw new Error('Not authenticated');

        const targetUser = await prisma.user.findFirst({
          where: {
            OR: [
              { username: args.username.toLowerCase() },
              { email: args.username.toLowerCase() },
            ],
          },
        });
        if (!targetUser) throw new Error('User not found');
        if (targetUser.id === context.userId) throw new Error('Cannot send request to yourself');

        // Check for existing friendship
        const existing = await prisma.friendship.findFirst({
          where: {
            requesterId: context.userId,
            addresseeId: targetUser.id,
          },
        });
        if (existing) throw new Error('Request already sent');

        // Create friendship request
        const friendship = await prisma.friendship.create({
          data: {
            requesterId: context.userId,
            addresseeId: targetUser.id,
            status: 'PENDING',
          },
          include: {
            requester: true,
            addressee: true,
          },
        });

        return {
          id: friendship.id,
          requester: friendship.requester,
          addressee: friendship.addressee,
          status: friendship.status,
          createdAt: friendship.createdAt,
        };
      },
    },
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

      // Search by username or email
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: args.username.toLowerCase() },
            { email: args.username.toLowerCase() },
          ],
        },
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
