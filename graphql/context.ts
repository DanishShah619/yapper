// Use the concrete Prisma client type from the singleton module
import prismaClient from '../lib/prisma';
import { Redis, type RedisOptions } from 'ioredis';
import { env } from '../lib/env';

import { RedisPubSub } from 'graphql-redis-subscriptions';

const REDIS_URL = env.REDIS_URL;

const redisConfig: RedisOptions = {
  lazyConnect: true,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
};

function createPubSubRedisClient(role: 'publisher' | 'subscriber'): Redis {
  const client = new Redis(REDIS_URL, redisConfig);
  client.on('error', (error) => {
    console.warn(`[RedisPubSub] ${role} connection error:`, error.message);
  });
  return client;
}

export const pubsub = new RedisPubSub({
  publisher: createPubSubRedisClient('publisher'),
  subscriber: createPubSubRedisClient('subscriber'),
});

export interface GraphQLContext {
  prisma: typeof prismaClient;
  redis: Redis;
  userId: string | null;
  sessionToken: string | null;
  clientIp: string;
  pubsub: RedisPubSub;
}
