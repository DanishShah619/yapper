import { withSecurityHeaders } from '@/lib/security-headers';
import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { NextRequest } from 'next/server';
import { typeDefs } from '@/graphql/type-defs';
import { resolvers } from '@/graphql/resolvers';
import prisma from '@/lib/prisma';
import redis from '@/lib/redis';
import { extractToken, validateSession } from '@/lib/auth';
import { GraphQLContext, pubsub } from '@/graphql/context';
import { cookies } from 'next/headers';
import { validateCsrfToken } from '@/lib/csrf';

const server = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
  introspection: true, // Enable GraphQL playground
});

const handler = startServerAndCreateNextHandler<NextRequest, GraphQLContext>(server, {
  context: async (req: NextRequest): Promise<GraphQLContext> => {
    // Extract JWT from secure httpOnly cookie
    const token = (await cookies()).get('nexchat_token')?.value || extractToken(req.headers.get('authorization'));

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
      pubsub,
    };
  },
});



export const GET = withSecurityHeaders(async (request: NextRequest) => {
  return handler(request);
});


export const POST = withSecurityHeaders(async (request: NextRequest) => {
  if (!(await validateCsrfToken(request))) {
    return Response.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }
  return handler(request);
});
