
import { randomUUID } from 'crypto';
import { GraphQLContext } from '@/graphql/context';
import { isConnected } from '@/lib/connections';

// ─── Ephemeral TTL whitelist (seconds) ───────────────────────────────────────
const ALLOWED_TTL = new Set([30, 300, 3600, 86400, 604800]);
const DEFAULT_EPHEMERAL_TTL = 300; // 5 min

// ─── Shape helpers ────────────────────────────────────────────────────────────
function toUserShape(u: { id: string; email: string; username: string; avatarUrl: string | null; publicKey: string | null; createdAt: Date }) {
  return { id: u.id, email: u.email, username: u.username, avatarUrl: u.avatarUrl, publicKey: u.publicKey, createdAt: u.createdAt };
}

function toRoomShape(room: {
  id: string; name: string | null; type: string; locked: boolean; createdAt: Date;
  members: { id: string; userId: string; role: string; mutedAt: Date | null; joinedAt: Date; user: { id: string; email: string; username: string; avatarUrl: string | null; publicKey: string | null; createdAt: Date } }[];
}) {
  return {
    id: room.id,
    name: room.name,
    type: room.type,
    locked: room.locked,
    createdAt: room.createdAt,
    members: room.members.map((m) => ({
      id: m.id,
      role: m.role,
      mutedAt: m.mutedAt,
      joinedAt: m.joinedAt,
      user: toUserShape(m.user),
    })),
  };
}

function toMsgShape(m: {
  id: string; roomId: string | null; groupId: string | null;
  encryptedPayload: string; ephemeral: boolean; expiresAt: Date | null; createdAt: Date;
  sender: { id: string; email: string; username: string; avatarUrl: string | null; publicKey: string | null; createdAt: Date };
}) {
  return {
    id: m.id,
    roomId: m.roomId,
    groupId: m.groupId,
    sender: toUserShape(m.sender),
    encryptedPayload: m.encryptedPayload,
    ephemeral: m.ephemeral,
    expiresAt: m.expiresAt,
    createdAt: m.createdAt,
  };
}

export const messagingResolvers = {
  // ─── Queries ───────────────────────────────────────────────────────────────
  Query: {
    // ── conversations — all rooms for the current user ────────────────────────
    conversations: async (
      _parent: unknown,
      _args: unknown,
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      const memberships = await ctx.prisma.roomMember.findMany({
        where: { userId: ctx.userId },
        include: {
          room: {
            include: {
              members: { include: { user: true } },
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
      });

      return memberships.map((m) => toRoomShape(m.room));
    },

    // ── conversation(id) — single room by ID, membership required ─────────────
    conversation: async (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      const room = await ctx.prisma.room.findUnique({
        where: { id: args.id },
        include: { members: { include: { user: true } } },
      });
      if (!room) return null;

      const isMember = room.members.some((m) => m.userId === ctx.userId);
      if (!isMember) throw new Error('Not a member of this room');

      return toRoomShape(room);
    },

    // ── messages — cursor pagination, roomId OR groupId ────────────────────────
    // Ephemeral messages are NOT returned (they exist only in Redis with TTL).
    // Cursor = base64-encoded ISO createdAt of the oldest visible message.
    // Reading goes backwards: pass the cursor of the oldest message to load older ones.
    messages: async (
      _parent: unknown,
      args: { roomId?: string; groupId?: string; cursor?: string; limit?: number },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      if (!args.roomId && !args.groupId) throw new Error('Either roomId or groupId is required');

      const limit = Math.min(args.limit ?? 50, 100);

      // Validate membership
      if (args.roomId) {
        const member = await ctx.prisma.roomMember.findFirst({
          where: { roomId: args.roomId, userId: ctx.userId },
        });
        if (!member) throw new Error('Not a member of this room');
      } else if (args.groupId) {
        const member = await ctx.prisma.groupMember.findFirst({
          where: { groupId: args.groupId, userId: ctx.userId },
        });
        if (!member) throw new Error('Not a member of this group');
      }

      // Decode cursor → Date (oldest message timestamp for next-page queries)
      let cursorDate: Date | undefined;
      if (args.cursor) {
        try {
          cursorDate = new Date(Buffer.from(args.cursor, 'base64').toString('utf-8'));
        } catch {
          // ignore malformed cursor
        }
      }

      const where: Record<string, unknown> = args.roomId
        ? { roomId: args.roomId, ephemeral: false }
        : { groupId: args.groupId, ephemeral: false };

      if (cursorDate) {
        where.createdAt = { lt: cursorDate };
      }

      // Fetch newest-first, then reverse to chronological ascending for display
      const rows = await ctx.prisma.message.findMany({
        where: where as import('@prisma/client').Prisma.MessageWhereInput,
        include: { sender: true },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // +1 to detect hasNextPage
      });

      const hasNextPage = rows.length > limit;
      const edges = hasNextPage ? rows.slice(0, limit) : rows;
      edges.reverse(); // chronological ascending

      const endCursor =
        edges.length > 0
          ? Buffer.from(edges[0].createdAt.toISOString()).toString('base64')
          : null;

      return {
        edges: edges.map(toMsgShape),
        pageInfo: { hasNextPage, endCursor },
      };
    },

    missedEphemeralMessages: async (
      _parent: unknown,
      args: { roomId?: string; groupId?: string; since: number },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      if (!args.roomId && !args.groupId) throw new Error('Either roomId or groupId is required');

      const bufferKey = args.roomId ? `ephemeral:room:${args.roomId}` : `ephemeral:group:${args.groupId}`;
      const rawMessages = await ctx.redis.lrange(bufferKey, 0, -1);

      return rawMessages
        .map((raw) => JSON.parse(raw))
        .filter((msg) => {
          const sentAt = new Date(msg.createdAt).getTime();
          const expires = new Date(msg.expiresAt).getTime();
          const sinceMs = args.since < 1e12 ? args.since * 1000 : args.since;
          return sentAt > sinceMs && expires > Date.now();
        })
        .reverse(); // LPUSH prepends, so reversing gives chronological order
    },
  },

  // ─── Mutations ─────────────────────────────────────────────────────────────
  Mutation: {
    // ── updatePublicKey — stores ECDH public key for DM key exchange ───────────
    updatePublicKey: async (
      _parent: unknown,
      args: { publicKey: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      const user = await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { publicKey: args.publicKey },
      });

      return toUserShape(user);
    },

    // ── createRoom — creates a named room ──────────────────────────────────────
    createRoom: async (
      _parent: unknown,
      args: { name: string; type: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      const room = await ctx.prisma.room.create({
        data: {
          name: args.name.trim() || null,
          type: (args.type || 'PERSISTENT') as 'PERSISTENT' | 'EPHEMERAL',
          createdBy: ctx.userId,
          members: { create: { userId: ctx.userId, role: 'ADMIN' } },
        },
        include: { members: { include: { user: true } } },
      });

      return toRoomShape(room);
    },

    // ── createDM — find existing DM or create new one ─────────────────────────
    // Idempotent: if a DM between these two users exists, returns it.
    // isConnected guard: only connected users can DM each other.
    createDM: async (
      _parent: unknown,
      args: { username: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      const target = await ctx.prisma.user.findUnique({
        where: { username: args.username.toLowerCase().trim() },
      });
      if (!target) throw new Error('User not found');
      if (target.id === ctx.userId) throw new Error('Cannot DM yourself');

      // Connection guard
      const connected = await isConnected(ctx.userId, target.id, ctx.prisma as Parameters<typeof isConnected>[2]);
      if (!connected) throw new Error('You must be connected to start a DM');

      // Find existing DM: a nameless room where BOTH users are members
      const myRoomIds = await ctx.prisma.roomMember.findMany({
        where: { userId: ctx.userId },
        select: { roomId: true },
      });

      const existingRoom = await ctx.prisma.room.findFirst({
        where: {
          id: { in: myRoomIds.map((r) => r.roomId) },
          name: null,
          members: { some: { userId: target.id } },
        },
        include: { members: { include: { user: true } } },
      });

      if (existingRoom) return toRoomShape(existingRoom);

      // Create fresh DM room — add both users atomically
      const dm = await ctx.prisma.room.create({
        data: {
          name: null, // null name identifies DMs
          type: 'PERSISTENT',
          createdBy: ctx.userId,
          members: {
            create: [
              { userId: ctx.userId, role: 'ADMIN' },
              { userId: target.id, role: 'MEMBER' },
            ],
          },
        },
        include: { members: { include: { user: true } } },
      });

      return toRoomShape(dm);
    },

    // ── inviteToRoom — add a connected user to a room ─────────────────────────
    inviteToRoom: async (
      _parent: unknown,
      args: { roomId: string; username: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      const room = await ctx.prisma.room.findUnique({ where: { id: args.roomId } });
      if (!room) throw new Error('Room not found');
      if (room.locked) throw new Error('Room is locked — new members cannot join');

      // Only room members can invite
      const inviterMember = await ctx.prisma.roomMember.findFirst({
        where: { roomId: args.roomId, userId: ctx.userId },
      });
      if (!inviterMember) throw new Error('Not a member of this room');

      const invitee = await ctx.prisma.user.findUnique({
        where: { username: args.username.toLowerCase().trim() },
      });
      if (!invitee) throw new Error('User not found');
      if (invitee.id === ctx.userId) throw new Error('Cannot invite yourself');

      // Must be connected to the invitee
      const connected = await isConnected(ctx.userId, invitee.id, ctx.prisma as Parameters<typeof isConnected>[2]);
      if (!connected) throw new Error('You must be connected to invite this user');

      // Prevent duplicate
      const alreadyMember = await ctx.prisma.roomMember.findFirst({
        where: { roomId: args.roomId, userId: invitee.id },
      });
      if (alreadyMember) throw new Error('User is already a member');

      const newMember = await ctx.prisma.roomMember.create({
        data: { roomId: args.roomId, userId: invitee.id, role: 'MEMBER' },
        include: { user: true },
      });

      return {
        id: newMember.id,
        role: newMember.role,
        mutedAt: newMember.mutedAt,
        joinedAt: newMember.joinedAt,
        user: toUserShape(newMember.user),
      };
    },

    // ── sendMessage — unified room + group handler ─────────────────────────────
    // Fixes B-04 (ephemeral always to PostgreSQL) and A-03 (groupId rejected).
    sendMessage: async (
      _parent: unknown,
      args: {
        roomId?: string;
        groupId?: string;
        encryptedPayload: string;
        ephemeral?: boolean;
        ttl?: number;
      },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      if (!args.roomId && !args.groupId) throw new Error('Either roomId or groupId is required');
      if (!args.encryptedPayload?.trim()) throw new Error('encryptedPayload is required');

      let isEphemeral = !!args.ephemeral;
      let ttl = args.ttl && ALLOWED_TTL.has(args.ttl) ? args.ttl : DEFAULT_EPHEMERAL_TTL;

      // ─── Room path ──────────────────────────────────────────────────────────
      if (args.roomId) {
        const room = await ctx.prisma.room.findUnique({ where: { id: args.roomId } });
        if (!room) throw new Error('Room not found');
        if (room.locked) throw new Error('ROOM_LOCKED');

        const member = await ctx.prisma.roomMember.findFirst({
          where: { roomId: args.roomId, userId: ctx.userId },
        });
        if (!member) throw new Error('Not a member of this room');
        if (member.mutedAt) throw new Error('MEMBER_MUTED');

        // Ephemeral room forces ephemeral flag on all messages
        if (room.type === 'EPHEMERAL') {
          isEphemeral = true;
          ttl = args.ttl && ALLOWED_TTL.has(args.ttl) ? args.ttl : 86400;
        }
      }

      // ─── Group path ─────────────────────────────────────────────────────────
      if (args.groupId) {
        const group = await ctx.prisma.group.findUnique({ where: { id: args.groupId } });
        if (!group) throw new Error('Group not found');
        if (group.locked) throw new Error('GROUP_LOCKED');

        const member = await ctx.prisma.groupMember.findFirst({
          where: { groupId: args.groupId, userId: ctx.userId },
        });
        if (!member) throw new Error('Not a member of this group');
        if (member.mutedAt) throw new Error('MEMBER_MUTED');

        if (group.type === 'EPHEMERAL') {
          isEphemeral = true;
          ttl = args.ttl && ALLOWED_TTL.has(args.ttl) ? args.ttl : 86400;
        }
      }

      const channel = args.roomId
        ? `messageReceived:${args.roomId}`
        : `messageReceived:${args.groupId}`;

      // ─── Ephemeral → Redis with TTL (never touches PostgreSQL) ──────────────
      if (isEphemeral) {
        const id = randomUUID();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ttl * 1000);

        const sender = await ctx.prisma.user.findUnique({ where: { id: ctx.userId } });

        const msg = {
          id,
          roomId: args.roomId ?? null,
          groupId: args.groupId ?? null,
          sender: toUserShape(sender!),
          encryptedPayload: args.encryptedPayload,
          ephemeral: true,
          expiresAt,
          createdAt: now,
        };

        await ctx.redis.set(`ephmsg:${id}`, JSON.stringify(msg), 'EX', ttl);
        
        // Push to buffer for disconnected clients (max 60s replay window)
        const bufferKey = args.roomId ? `ephemeral:room:${args.roomId}` : `ephemeral:group:${args.groupId}`;
        await ctx.redis.lpush(bufferKey, JSON.stringify(msg));
        const bufferTtl = Math.min(ttl, 60);
        await ctx.redis.expire(bufferKey, bufferTtl);

        ctx.pubsub.publish(channel, msg);
        return msg;
      }

      // ─── Persistent → PostgreSQL ─────────────────────────────────────────────
      const message = await ctx.prisma.message.create({
        data: {
          roomId: args.roomId ?? null,
          groupId: args.groupId ?? null,
          senderId: ctx.userId,
          encryptedPayload: args.encryptedPayload,
          ephemeral: false,
          expiresAt: null,
        },
        include: { sender: true },
      });

      const shaped = toMsgShape(message);
      ctx.pubsub.publish(channel, shaped);
      return shaped;
    },
  },

  // ─── Subscriptions ─────────────────────────────────────────────────────────
  Subscription: {
    messageReceived: {
      subscribe: async (
        _parent: unknown,
        args: { roomId: string },
        ctx: GraphQLContext
      ) => {
        if (!ctx.userId) throw new Error('Not authenticated');

        // The roomId argument can be either a roomId or a groupId (UUID either way)
        const [roomMember, groupMember] = await Promise.all([
          ctx.prisma.roomMember.findFirst({
            where: { roomId: args.roomId, userId: ctx.userId },
          }),
          ctx.prisma.groupMember.findFirst({
            where: { groupId: args.roomId, userId: ctx.userId },
          }),
        ]);

        if (!roomMember && !groupMember) throw new Error('Not a member');

        return ctx.pubsub.asyncIterator(`messageReceived:${args.roomId}`);
      },
      resolve: (payload: unknown) => payload,
    },
  },
};
