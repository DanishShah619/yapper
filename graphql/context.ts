import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

export interface GraphQLContext {
  prisma: PrismaClient;
  redis: Redis;
  userId: string | null;
  clientIp: string;
}
