import { authResolvers } from './auth';
import { userResolvers } from './user';
import { stubResolvers } from './stubs';
import { groupResolvers } from './groups';
import { GraphQLScalarType, Kind } from 'graphql';

// Custom DateTime scalar
const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'A date-time string in ISO 8601 format',
  serialize(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      return new Date(value).toISOString();
    }
    throw new Error('DateTime scalar: invalid value');
  },
  parseValue(value: unknown): Date {
    if (typeof value === 'string') {
      return new Date(value);
    }
    throw new Error('DateTime scalar: invalid input');
  },
  parseLiteral(ast): Date {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    throw new Error('DateTime scalar: invalid literal');
  },
});

// Merge all resolver maps
export const resolvers = {
  DateTime: DateTimeScalar,

  Query: {
    ...userResolvers.Query,
  },

  Mutation: {
    ...authResolvers.Mutation,
    // Phase 2 connection mutations from userResolvers (respondToConnectionRequest, sendConnectionRequest)
    ...userResolvers.Mutation,
    // Phase 3-4 room/message/video stubs
    ...stubResolvers.Mutation,
    // Phase 5 group mutations (override any stubs for group mutations)
    ...groupResolvers.Mutation,
  },

  Subscription: {
    ...groupResolvers.Subscription,
  },
};
