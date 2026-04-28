import { authResolvers } from './auth';
import { userResolvers } from './user';
import { stubResolvers } from './stubs';
import { groupResolvers } from './groups';
import { messagingResolvers } from './messaging';
import { keyEscrowResolvers } from './keyEscrow';
import { keyDeliveryTrackingResolvers } from './keyDeliveryTracking';
import { videoResolvers } from './video';
import { GraphQLScalarType, Kind } from 'graphql';

// Custom DateTime scalar
const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'A date-time string in ISO 8601 format',
  serialize(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return new Date(value).toISOString();
    throw new Error('DateTime scalar: invalid value');
  },
  parseValue(value: unknown): Date {
    if (typeof value === 'string') return new Date(value);
    throw new Error('DateTime scalar: invalid input');
  },
  parseLiteral(ast): Date {
    if (ast.kind === Kind.STRING) return new Date(ast.value);
    throw new Error('DateTime scalar: invalid literal');
  },
});

// ─── Resolver merge — spread order matters (later spreads WIN for duplicate keys) ─────
//
// Precedence (lowest → highest):
//   stubs < messaging < user(Phase2) < auth(Phase1) < groups(Phase5)
//
// This ensures:
//   1. Messaging.sendMessage wins over the deleted stubs
//   2. User.Mutation wins over messaging (Phase2 social > Phase3 messaging for any overlap)
//   3. Groups always win last (Phase5 has dedicated group mutations)

export const resolvers = {
  DateTime: DateTimeScalar,

  Query: {
    // Phase 1-2: Auth + social graph queries + V2 stubs
    ...userResolvers.Query,
    // Phase 3: Messaging queries (conversations, conversation, messages) — override user stubs
    ...messagingResolvers.Query,
    // Key Escrow queries (myKeyShard, userPublicKeys)
    ...keyEscrowResolvers.Query,
    // Key Delivery Tracking queries (roomKeyHealth, memberKeyDeliveryDetails)
    ...keyDeliveryTrackingResolvers.Query,
  },

  Mutation: {
    // Phase 1: Auth
    ...authResolvers.Mutation,
    // Phase 4 video + V2 stubs
    ...stubResolvers.Mutation,
    // Phase 3: Messaging (createRoom, createDM, inviteToRoom, sendMessage, updatePublicKey)
    ...messagingResolvers.Mutation,
    // Phase 2: Social graph (sendConnectionRequest, respondToConnectionRequest, removeConnection)
    ...userResolvers.Mutation,
    // Phase 5: Group mutations — highest precedence, always wins
    ...groupResolvers.Mutation,
    // Key Escrow mutations (uploadKeyShards, rotateKey, setFallbackAdmin, promoteFallbackAdmin)
    ...keyEscrowResolvers.Mutation,
    // Key Delivery Tracking mutations (redeliverKey)
    ...keyDeliveryTrackingResolvers.Mutation,
    // Phase 4: Video
    ...videoResolvers.Mutation,
  },

  Subscription: {
    // Phase 3: messageReceived
    ...messagingResolvers.Subscription,
    // Phase 5: groupMemberUpdated
    ...groupResolvers.Subscription,
    // Key Delivery Tracking subscription (keyHealthUpdated)
    ...keyDeliveryTrackingResolvers.Subscription,
    // Phase 4: Video subscriptions
    ...videoResolvers.Subscription,
  },
};
