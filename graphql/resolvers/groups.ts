import { GraphQLContext } from '@/graphql/context';
import { v4 as uuidv4 } from 'uuid';
import { isConnected } from '@/lib/connections';
import crypto from 'crypto';

// Inline type for GroupMember rows returned by Prisma findMany
type GroupMemberRow = { id: string; groupId: string; userId: string; role: string; mutedAt: Date | null; joinedAt: Date };

// Helper: validate that caller is an admin of the group
async function requireAdmin(groupId: string, userId: string, ctx: GraphQLContext) {
  const admin = await ctx.prisma.groupMember.findFirst({
    where: { groupId, userId, role: 'ADMIN' },
  });
  if (!admin) throw new Error('Not authorized — admin role required');
  return admin;
}

// Helper: validate that caller is a member of the group
async function requireMember(groupId: string, userId: string, ctx: GraphQLContext) {
  const member = await ctx.prisma.groupMember.findFirst({
    where: { groupId, userId },
  });
  if (!member) throw new Error('Not a member of this group');
  return member;
}

// Helper: validate mutual connection between two users (uses shared lib/connections utility)
async function requireConnectionGuard(userAId: string, userBId: string, ctx: GraphQLContext) {
  const connected = await isConnected(userAId, userBId, ctx.prisma as Parameters<typeof isConnected>[2]);
  if (!connected) throw new Error('Users are not connected — cannot add to group');
}

// Full group object with relations for GraphQL return
async function getGroupWithMembersAndCreator(groupId: string, ctx: GraphQLContext) {
  const group = await ctx.prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: true } },
      creator: true,
    },
  });
  if (!group) throw new Error('Group not found');
  return group;
}

// Function to rotate encryption keys for a group
async function rotateKey(groupId: string, adminId: string, ctx: GraphQLContext) {
  // Validate admin privileges
  await requireAdmin(groupId, adminId, ctx);

  // Fetch group members
  const members = await ctx.prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true },
  });

  // Generate new AES key
  const newKey = crypto.randomBytes(32); // 256-bit key

  // Encrypt new key for each member
  const encryptedKeys = await Promise.all(
    members.map(async (member) => {
      const publicKey = member.user.publicKey;
      if (!publicKey) {
        throw new Error(`Missing public key for user ${member.userId}`);
      }
      return {
        userId: member.userId,
        encryptedKey: crypto.publicEncrypt(publicKey, newKey),
      };
    })
  );

  // Update group metadata with new key
  await ctx.prisma.group.update({
    where: { id: groupId },
    data: { encryptionKey: newKey.toString('base64') },
  });

  // Notify members of key rotation
  encryptedKeys.forEach(({ userId, encryptedKey }) => {
    ctx.pubsub.publish(`GROUP_KEY_ROTATION_${userId}`, {
      groupId,
      encryptedKey: encryptedKey.toString('base64'),
    });
  });

  return true;
}

// Modify removeMember to trigger key rotation
async function removeMember(groupId: string, memberId: string, adminId: string, ctx: GraphQLContext) {
  // Validate admin privileges
  await requireAdmin(groupId, adminId, ctx);

  // Remove member
  await ctx.prisma.groupMember.delete({
    where: { groupId_userId: { groupId, userId: memberId } },
  });

  // Rotate keys
  await rotateKey(groupId, adminId, ctx);

  return true;
}

export const groupResolvers = {
  Mutation: {
    // ─── 5.1: Group CRUD ─────────────────────────────────────────────
    createGroup: async (
      _parent: unknown,
      args: { name: string; type: string; avatar?: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      if (!args.name || args.name.trim().length === 0) throw new Error('Group name is required');
      if (args.name.length > 80) throw new Error('Group name must be under 80 characters');

      const group = await ctx.prisma.group.create({
        data: {
          name: args.name.trim(),
          type: (args.type || 'PERSISTENT') as 'PERSISTENT' | 'EPHEMERAL',
          avatarUrl: args.avatar || null,
          createdBy: ctx.userId,
        },
      });

      // Creator becomes ADMIN
      await ctx.prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId: ctx.userId,
          role: 'ADMIN',
        },
      });

      return getGroupWithMembersAndCreator(group.id, ctx);
    },

    deleteGroup: async (
      _parent: unknown,
      args: { groupId: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      await requireAdmin(args.groupId, ctx.userId, ctx);
      // Prisma cascade deletes group_members, messages with groupId, etc.
      await ctx.prisma.group.delete({ where: { id: args.groupId } });
      return true;
    },

    // ─── 5.2: Member Management ──────────────────────────────────────
    addGroupMember: async (
      _parent: unknown,
      args: { groupId: string; username: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      const group = await ctx.prisma.group.findUnique({ where: { id: args.groupId } });
      if (!group) throw new Error('Group not found');
      if (group.locked) throw new Error('Group is locked — cannot add new members');

      // Enforce memberAddPolicy
      if (group.memberAddPolicy === 'ADMIN_ONLY') {
        await requireAdmin(args.groupId, ctx.userId, ctx);
      } else {
        await requireMember(args.groupId, ctx.userId, ctx);
      }

      // Find invitee by username
      const invitee = await ctx.prisma.user.findFirst({
        where: { username: args.username.toLowerCase() },
      });
      if (!invitee) throw new Error('User not found');
      if (invitee.id === ctx.userId) throw new Error('Cannot add yourself');

      // Must be a connection of the adder
      await requireConnectionGuard(ctx.userId, invitee.id, ctx);

      // Check not already a member
      const existing = await ctx.prisma.groupMember.findFirst({
        where: { groupId: args.groupId, userId: invitee.id },
      });
      if (existing) throw new Error('User is already a member of this group');

      const member = await ctx.prisma.groupMember.create({
        data: { groupId: args.groupId, userId: invitee.id, role: 'MEMBER' },
        include: { user: true },
      });

      // Real-time subscription event
      ctx.pubsub.publish(`groupMemberUpdated:${args.groupId}`, member);

      return member;
    },

    removeGroupMember: async (
      _parent: unknown,
      args: { groupId: string; userId: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      await requireAdmin(args.groupId, ctx.userId, ctx);

      if (args.userId === ctx.userId) throw new Error('Use leaveGroup to remove yourself');

      await ctx.prisma.groupMember.deleteMany({
        where: { groupId: args.groupId, userId: args.userId },
      });

      ctx.pubsub.publish(`groupMemberUpdated:${args.groupId}`, {
        id: args.userId,
        groupId: args.groupId,
        removed: true,
      });

      const remaining = await ctx.prisma.groupMember.findMany({
        where: { groupId: args.groupId },
      });
      // If no admin is online to rotate keys, queue the rotation request and notify all admins on next login.
      // TODO: Implement fallback so any admin or backup can rotate keys if the primary admin is offline.
      // Optionally, persist a rotation-required flag in the DB and check on admin login.
      ctx.pubsub.publish(`groupKeyRotationRequired:${args.groupId}`, {
        groupId: args.groupId,
        remainingMemberIds: remaining.map((m) => m.userId),
        rotationRequired: true, // for future extensibility
      });

      return true;
    },

    promoteGroupMember: async (
      _parent: unknown,
      args: { groupId: string; userId: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      await requireAdmin(args.groupId, ctx.userId, ctx);

      const updated = await ctx.prisma.groupMember.updateMany({
        where: { groupId: args.groupId, userId: args.userId },
        data: { role: 'ADMIN' },
      });

      if (updated.count === 0) throw new Error('Member not found in this group');

      const member = await ctx.prisma.groupMember.findFirst({
        where: { groupId: args.groupId, userId: args.userId },
        include: { user: true },
      });

      ctx.pubsub.publish(`groupMemberUpdated:${args.groupId}`, member);

      return member;
    },

    transferGroupOwnership: async (
      _parent: unknown,
      args: { groupId: string; userId: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      await requireAdmin(args.groupId, ctx.userId, ctx);

      if (args.userId === ctx.userId) throw new Error('Cannot transfer ownership to yourself');

      // Target must be a member
      const target = await ctx.prisma.groupMember.findFirst({
        where: { groupId: args.groupId, userId: args.userId },
      });
      if (!target) throw new Error('Target user is not a member of this group');

      // Promote target to ADMIN, demote caller to MEMBER
      await ctx.prisma.$transaction([
        ctx.prisma.groupMember.updateMany({
          where: { groupId: args.groupId, userId: args.userId },
          data: { role: 'ADMIN' },
        }),
        ctx.prisma.groupMember.updateMany({
          where: { groupId: args.groupId, userId: ctx.userId },
          data: { role: 'MEMBER' },
        }),
      ]);

      ctx.pubsub.publish(`groupMemberUpdated:${args.groupId}`, {
        type: 'OWNERSHIP_TRANSFERRED',
        newAdminId: args.userId,
      });

      return getGroupWithMembersAndCreator(args.groupId, ctx);
    },

    muteGroupMember: async (
      _parent: unknown,
      args: { groupId: string; userId: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      await requireAdmin(args.groupId, ctx.userId, ctx);

      // Check if already muted for toggle behaviour
      const member = await ctx.prisma.groupMember.findFirst({
        where: { groupId: args.groupId, userId: args.userId },
        include: { user: true },
      });
      if (!member) throw new Error('Member not found in this group');

      const updatedMember = await ctx.prisma.groupMember.update({
        where: { id: member.id },
        data: { mutedAt: member.mutedAt ? null : new Date() }, // toggle
        include: { user: true },
      });

      ctx.pubsub.publish(`groupMemberUpdated:${args.groupId}`, updatedMember);

      return updatedMember;
    },

    submitRotatedGroupKeys: async (
      _parent: unknown,
      args: { groupId: string; wrappedKeys: { memberId: string; encryptedKey: string }[] },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      
      // We don't enforce requireAdmin strictly because sometimes a regular member 
      // with memberAddPolicy=open might wrap keys when adding someone.
      // But typically this is an admin action for rotation.
      await requireMember(args.groupId, ctx.userId, ctx);

      const updates = args.wrappedKeys.map((wk) =>
        ctx.prisma.groupMember.update({
          where: { groupId_userId: { groupId: args.groupId, userId: wk.memberId } },
          data: { encryptedKey: wk.encryptedKey },
        })
      );
      
      await ctx.prisma.$transaction(updates);
      return true;
    },

    leaveGroup: async (
      _parent: unknown,
      args: { groupId: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      await requireMember(args.groupId, ctx.userId, ctx);

      // If this user is the only admin and other members exist, reject
      const allMembers = await ctx.prisma.groupMember.findMany({
        where: { groupId: args.groupId },
      });
      const otherMembers = allMembers.filter((m: GroupMemberRow) => m.userId !== ctx.userId);
      const otherAdmins = allMembers.filter(
        (m: GroupMemberRow) => m.userId !== ctx.userId && m.role === 'ADMIN'
      );

      if (otherMembers.length > 0 && otherAdmins.length === 0) {
        // Check if current user is an admin
        const isAdmin = allMembers.some(
          (m: GroupMemberRow) => m.userId === ctx.userId && m.role === 'ADMIN'
        );
        if (isAdmin) throw new Error('MUST_TRANSFER_OWNERSHIP — you are the only admin');
      }

      await ctx.prisma.groupMember.deleteMany({
        where: { groupId: args.groupId, userId: ctx.userId },
      });

      ctx.pubsub.publish(`groupMemberUpdated:${args.groupId}`, {
        id: ctx.userId,
        groupId: args.groupId,
        left: true,
      });

      const remainingAfterLeave = await ctx.prisma.groupMember.findMany({
        where: { groupId: args.groupId },
      });
      // If no admin is online to rotate keys, queue the rotation request and notify all admins on next login.
      // TODO: Implement fallback so any admin or backup can rotate keys if the primary admin is offline.
      // Optionally, persist a rotation-required flag in the DB and check on admin login.
      ctx.pubsub.publish(`groupKeyRotationRequired:${args.groupId}`, {
        groupId: args.groupId,
        remainingMemberIds: remainingAfterLeave.map((m) => m.userId),
        rotationRequired: true, // for future extensibility
      });

      return true;
    },

    lockGroup: async (
      _parent: unknown,
      args: { groupId: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      await requireAdmin(args.groupId, ctx.userId, ctx);

      const group = await ctx.prisma.group.update({
        where: { id: args.groupId },
        data: { locked: true },
        include: { members: { include: { user: true } }, creator: true },
      });

      return group;
    },

    updateMemberAddPolicy: async (
      _parent: unknown,
      args: { groupId: string; policy: 'ADMIN_ONLY' | 'OPEN' },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');
      await requireAdmin(args.groupId, ctx.userId, ctx);

      const group = await ctx.prisma.group.update({
        where: { id: args.groupId },
        data: { memberAddPolicy: args.policy },
        include: { members: { include: { user: true } }, creator: true },
      });

      return group;
    },

    // ─── 5.3: Group Invite Links ─────────────────────────────────────
    generateInviteLink: async (
      _parent: unknown,
      args: { groupId?: string; roomId?: string; ttl: number },
      ctx: GraphQLContext
    ) => {
      if (!ctx.userId) throw new Error('Not authenticated');

      if (args.groupId) {
        await requireAdmin(args.groupId, ctx.userId, ctx);

        const token = uuidv4();
        await ctx.redis.set(`invite:${token}`, JSON.stringify({ type: 'group', id: args.groupId }), 'EX', args.ttl);

        const expiresAt = new Date(Date.now() + args.ttl * 1000);
        return { url: `/invite/${token}`, expiresAt };
      } else if (args.roomId) {
        // Room invite — validate room admin
        const roomMember = await ctx.prisma.roomMember.findFirst({
          where: { roomId: args.roomId, userId: ctx.userId, role: 'ADMIN' },
        });
        if (!roomMember) throw new Error('Not authorized — admin role required');

        const token = uuidv4();
        await ctx.redis.set(`invite:${token}`, JSON.stringify({ type: 'room', id: args.roomId }), 'EX', args.ttl);

        const expiresAt = new Date(Date.now() + args.ttl * 1000);
        return { url: `/invite/${token}`, expiresAt };
      } else {
        throw new Error('Either groupId or roomId must be provided');
      }
    },
  },

  Subscription: {
    groupMemberUpdated: {
      subscribe: async (
        _parent: unknown,
        args: { groupId: string },
        ctx: GraphQLContext
      ) => {
        if (!ctx.userId) throw new Error('Not authenticated');
        // Validate membership for subscription auth
        const member = await ctx.prisma.groupMember.findFirst({
          where: { groupId: args.groupId, userId: ctx.userId },
        });
        if (!member) throw new Error('Not a member of this group');
        return ctx.pubsub.asyncIterator(`groupMemberUpdated:${args.groupId}`);
      },
      resolve: (payload: unknown) => payload,
    },
    groupKeyRotationRequired: {
      subscribe: async (_parent: unknown, args: { groupId: string }, ctx: GraphQLContext) => {
        if (!ctx.userId) throw new Error('Not authenticated');
        return ctx.pubsub.asyncIterator(`groupKeyRotationRequired:${args.groupId}`);
      },
      resolve: (payload: unknown) => payload,
    },
  },
};
