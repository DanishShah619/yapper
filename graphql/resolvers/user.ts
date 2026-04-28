import prisma from '@/lib/prisma';
import { GraphQLContext } from '@/graphql/context';

// ─── Helper: shape a raw Prisma user into the GraphQL User type ─────────────
function toUserShape(user: {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

export const userResolvers = {
  // ─── Type Resolvers ────────────────────────────────────────────────────────
  User: {
    online: async (parent: { id: string }, _args: unknown, context: GraphQLContext) => {
      try {
        const val = await context.redis.get(`presence:${parent.id}`);
        return !!val;
      } catch (err) {
        return false;
      }
    },
  },

  // ─── Queries ───────────────────────────────────────────────────────────────
  Query: {
    // ── me ────────────────────────────────────────────────────────────────────
    me: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      if (!context.userId) throw new Error('Not authenticated');

      const user = await prisma.user.findUnique({
        where: { id: context.userId },
      });
      if (!user) throw new Error('User not found');

      return toUserShape(user);
    },

    // ── user(username) — task 2.1.1, fixes B-03 ───────────────────────────────
    // PRD FR-3: username-only search (no email fallback — that's a privacy leak)
    user: async (
      _parent: unknown,
      args: { username: string },
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');
      if (!args.username || !args.username.trim()) return null;

      const user = await prisma.user.findUnique({
        where: { username: args.username.toLowerCase().trim() },
      });

      if (!user) return null;

      // Never expose your own record doubled; return public profile only
      return toUserShape(user);
    },

    // ── connections — task 2.2.4 ──────────────────────────────────────────────
    // Returns all ACCEPTED connections for the current user as User objects
    connections: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');

      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { requesterId: context.userId, status: 'ACCEPTED' },
            { addresseeId: context.userId, status: 'ACCEPTED' },
          ],
        },
        include: {
          requester: true,
          addressee: true,
        },
      });

      // Return the "other" user in each accepted friendship
      return friendships.map((f) =>
        toUserShape(f.requesterId === context.userId ? f.addressee : f.requester)
      );
    },

    // ── connectionRequests — task 2.2.3 ───────────────────────────────────────
    // Returns all PENDING incoming friendship requests for the current user
    connectionRequests: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');

      const requests = await prisma.friendship.findMany({
        where: {
          addresseeId: context.userId,
          status: 'PENDING',
        },
        include: {
          requester: true,
          addressee: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return requests.map((f) => ({
        id: f.id,
        requester: toUserShape(f.requester),
        addressee: toUserShape(f.addressee),
        status: f.status,
        createdAt: f.createdAt,
      }));
    },

    // ─── Phase 3 stubs ────────────────────────────────────────────────────────
    conversations: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');
      // TODO: Phase 3 — Return all DM conversations for current user
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
      // TODO: Phase 3 — Cursor-based pagination with encryption
      return { edges: [], pageInfo: { hasNextPage: false, endCursor: null } };
    },

    // ─── Group queries (delegated from here for single-resolver-file clarity) ──
    group: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');

      const group = await prisma.group.findUnique({
        where: { id: args.id },
        include: {
          members: { include: { user: true } },
          creator: true,
        },
      });
      if (!group) return null;

      // Only members can query group details
      const member = await prisma.groupMember.findFirst({
        where: { groupId: args.id, userId: context.userId },
      });
      if (!member) throw new Error('Not authorized');

      return group;
    },

    groups: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');

      const memberships = await prisma.groupMember.findMany({
        where: { userId: context.userId },
        include: {
          group: {
            include: {
              members: { include: { user: true } },
              creator: true,
            },
          },
        },
      });

      return memberships.map((m) => m.group);
    },

    // ─── V2 Stubs ─────────────────────────────────────────────────────────────
    peopleYouMayKnow: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');
      // TODO (V2): Implement mutual connection suggestion algorithm.
      // Suggest users with 2+ mutual friends, excluding current friends and self.
      // See PRD FR-4 for details.
      return [];
    },

    feed: async (
      _parent: unknown,
      _args: { cursor?: string; limit?: number },
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');
      // TODO (V2): Implement reverse-chronological feed from connections' posts.
      // See PRD FR-14 for details.
      return [];
    },
  },

  // ─── Mutations ─────────────────────────────────────────────────────────────
  Mutation: {
    // ── sendConnectionRequest — task 2.2.1, fixes B-01/B-02/B-22 ─────────────
    sendConnectionRequest: async (
      _parent: unknown,
      args: { username: string },
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');
      // Input validation
      const { validateInput, sendConnectionRequestSchema } = await import('@/lib/validation');
      const validated = validateInput(sendConnectionRequestSchema, args);

      // PRD FR-3: username-only lookup (no email fallback)
      const targetUser = await prisma.user.findUnique({
        where: { username: validated.username.toLowerCase().trim() },
      });
      if (!targetUser) throw new Error('User not found');
      if (targetUser.id === context.userId) throw new Error('Cannot send a request to yourself');

      // Check for any existing friendship in either direction
      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: context.userId, addresseeId: targetUser.id },
            { requesterId: targetUser.id, addresseeId: context.userId },
          ],
        },
      });
      if (existing) {
        if (existing.status === 'ACCEPTED') throw new Error('Already connected');
        if (existing.status === 'PENDING') throw new Error('Connection request already pending');
        if (existing.status === 'DECLINED') {
          // Allow re-sending after a declined request
          await prisma.friendship.delete({ where: { id: existing.id } });
        }
      }

      const friendship = await prisma.friendship.create({
        data: {
          requesterId: context.userId,
          addresseeId: targetUser.id,
          status: 'PENDING',
        },
        include: { requester: true, addressee: true },
      });

      // Real-time notification: publish to the addressee's channel
      // task 2.2.6 — frontend subscribes to connectionRequest:received
      context.pubsub.publish(`connectionRequest:${targetUser.id}`, {
        type: 'REQUEST_RECEIVED',
        friendship: {
          id: friendship.id,
          requester: toUserShape(friendship.requester),
          addressee: toUserShape(friendship.addressee),
          status: friendship.status,
          createdAt: friendship.createdAt,
        },
      });

      return {
        id: friendship.id,
        requester: toUserShape(friendship.requester),
        addressee: toUserShape(friendship.addressee),
        status: friendship.status,
        createdAt: friendship.createdAt,
      };
    },

    // ── respondToConnectionRequest — task 2.2.2, fixes B-01/B-02 ─────────────
    respondToConnectionRequest: async (
      _parent: unknown,
      args: { requestId: string; accept: boolean },
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');

      const friendship = await prisma.friendship.findUnique({
        where: { id: args.requestId },
        include: { requester: true, addressee: true },
      });
      if (!friendship) throw new Error('Request not found');
      if (friendship.addresseeId !== context.userId) throw new Error('Not authorized');
      if (friendship.status !== 'PENDING') throw new Error('Request already handled');

      const updated = await prisma.friendship.update({
        where: { id: args.requestId },
        data: { status: args.accept ? 'ACCEPTED' : 'DECLINED' },
        include: { requester: true, addressee: true },
      });

      return {
        id: updated.id,
        requester: toUserShape(updated.requester),
        addressee: toUserShape(updated.addressee),
        status: updated.status,
        createdAt: updated.createdAt,
      };
    },

    // ── removeConnection — task 2.2.5 ─────────────────────────────────────────
    // Deletes the friendship record in either direction — both users lose DM access
    removeConnection: async (
      _parent: unknown,
      args: { userId: string },
      context: GraphQLContext
    ) => {
      if (!context.userId) throw new Error('Not authenticated');

      const deleted = await prisma.friendship.deleteMany({
        where: {
          status: 'ACCEPTED',
          OR: [
            { requesterId: context.userId, addresseeId: args.userId },
            { requesterId: args.userId, addresseeId: context.userId },
          ],
        },
      });

      if (deleted.count === 0) throw new Error('Connection not found');

      return true;
    },
  },

  // ─── Subscriptions ─────────────────────────────────────────────────────────
  Subscription: {
    presenceUpdated: {
      subscribe: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
        if (!context.userId) throw new Error('Not authenticated');
        return context.pubsub.asyncIterator(`presenceUpdated:${context.userId}`);
      },
      resolve: (payload: any) => payload.presenceUpdated,
    },
  },
};
