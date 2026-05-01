import 'dotenv/config';
// Use the concrete Prisma client type from the singleton module
import prismaClient from '@/lib/prisma';
import { Redis } from 'ioredis';

import { RedisPubSub } from 'graphql-redis-subscriptions';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisConfig = {
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
};

export const pubsub = new RedisPubSub({
  publisher: new Redis(REDIS_URL, redisConfig),
  subscriber: new Redis(REDIS_URL, redisConfig),
});

export interface GraphQLContext {
  prisma: typeof prismaClient;
  redis: Redis;
  userId: string | null;
  clientIp: string;
  pubsub: RedisPubSub;
}
