import 'dotenv/config';
import Redis from 'ioredis';

type NodeEnv = 'development' | 'production' | 'test';

type AppEnv = {
  NODE_ENV: NodeEnv;
  PORT: string;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  LIVEKIT_URL: string;
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
  NEXT_PUBLIC_LIVEKIT_URL: string;
  APP_ORIGIN: string;
};

const rawNodeEnv = process.env.NODE_ENV;
const NODE_ENV: NodeEnv =
  rawNodeEnv === 'production' || rawNodeEnv === 'test' ? rawNodeEnv : 'development';

const requiredInProduction = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'NEXT_PUBLIC_LIVEKIT_URL',
  'APP_ORIGIN',
] as const;

if (NODE_ENV === 'production') {
  const missing = requiredInProduction.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required production environment variables: ${missing.join(', ')}`
    );
  }
}

export const env: AppEnv = {
  NODE_ENV,
  PORT: process.env.PORT?.trim() || '3000',
  DATABASE_URL: process.env.DATABASE_URL?.trim() || '',
  REDIS_URL:
    process.env.REDIS_URL?.trim() ||
    (NODE_ENV === 'production' ? '' : 'redis://localhost:6379'),
  JWT_SECRET: process.env.JWT_SECRET?.trim() || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN?.trim() || '7d',
  LIVEKIT_URL:
    process.env.LIVEKIT_URL?.trim() ||
    (NODE_ENV === 'production' ? '' : 'ws://localhost:7880'),
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY?.trim() || '',
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET?.trim() || '',
  NEXT_PUBLIC_LIVEKIT_URL:
    process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() ||
    (NODE_ENV === 'production' ? '' : 'ws://localhost:7880'),
  APP_ORIGIN:
    process.env.APP_ORIGIN?.trim() ||
    (NODE_ENV === 'production' ? '' : 'http://localhost:3000'),
};

export async function verifyRedisConnection(): Promise<void> {
  const client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });

  try {
    await client.connect();
    const pong = await client.ping();
    if (pong !== 'PONG') {
      throw new Error(`Unexpected Redis PING response: ${pong}`);
    }
    console.log('[startup] Redis OK');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[startup] Redis PING failed: ${message}`);
  } finally {
    client.disconnect();
  }
}
