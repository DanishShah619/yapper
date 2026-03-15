import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { NextRequest } from 'next/server';
import { typeDefs } from '@/graphql/type-defs';
import { resolvers } from '@/graphql/resolvers';
import prisma from '@/lib/prisma';
import redis from '@/lib/redis';
import { extractToken, validateSession } from '@/lib/auth';
import { GraphQLContext } from '@/graphql/context';

const server = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
  introspection: true, // Enable GraphQL playground
});

const handler = startServerAndCreateNextHandler<NextRequest, GraphQLContext>(server, {
  context: async (req: NextRequest): Promise<GraphQLContext> => {
    // Extract JWT from Authorization header
    const authHeader = req.headers.get('authorization');
    const token = extractToken(authHeader);

    // Validate token against Redis session cache
    let userId: string | null = null;
    if (token) {
      userId = await validateSession(token);
    }

    // Get client IP for rate limiting
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    return {
      prisma,
      redis,
      userId,
      clientIp,
    };
  },
});

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}
