import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import { setSession, deleteSession } from '@/lib/session';
import { rateLimit } from '@/lib/rate-limit';
import { GraphQLContext } from '@/graphql/context';

export const authResolvers = {
  Mutation: {
    register: async (
      _parent: unknown,
      args: { email: string; username: string; password: string }
    ) => {
      const { email, username, password } = args;

      // Validate input
      if (!email || !username || !password) {
        throw new Error('Email, username, and password are required');
      }
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }
      if (username.length < 3 || username.length > 30) {
        throw new Error('Username must be between 3 and 30 characters');
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        throw new Error('Username can only contain letters, numbers, and underscores');
      }

      // Check for existing user
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
        },
      });

      if (existingUser) {
        if (existingUser.email === email.toLowerCase()) {
          throw new Error('Email already in use');
        }
        throw new Error('Username already taken');
      }

      // Hash password with bcrypt cost factor 12
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          username: username.toLowerCase(),
          passwordHash,
        },
      });

      // Generate JWT and cache in Redis
      const token = generateToken(user.id);
      await setSession(user.id, token);

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
        },
      };
    },

    login: async (
      _parent: unknown,
      args: { email: string; password: string },
      context: GraphQLContext
    ) => {
      const { email, password } = args;

      // Rate limiting: 5 attempts per 15 minutes per IP
      const clientIp = context.clientIp || 'unknown';
      const rateLimitResult = await rateLimit(
        `ratelimit:auth:${clientIp}`,
        5,
        900 // 15 minutes
      );

      if (!rateLimitResult.allowed) {
        throw new Error(
          'Too many login attempts. Please try again in 15 minutes.'
        );
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Verify password
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        throw new Error('Invalid email or password');
      }

      // Generate JWT and cache in Redis
      const token = generateToken(user.id);
      await setSession(user.id, token);

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
        },
      };
    },

    logout: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) => {
      if (!context.userId) {
        throw new Error('Not authenticated');
      }

      // Delete Redis session immediately
      await deleteSession(context.userId);
      return true;
    },
  },
};
