// Use the concrete Prisma client type from the singleton module
import prismaClient from '@/lib/prisma';
import { Redis } from 'ioredis';

// Simple in-process pubsub for GraphQL subscriptions
// In production, this would be backed by Redis pub/sub
export class PubSub {
  private listeners: Map<string, Set<(payload: unknown) => void>> = new Map();

  publish(channel: string, payload: unknown): void {
    const channelListeners = this.listeners.get(channel);
    if (channelListeners) {
      channelListeners.forEach((listener) => listener(payload));
    }
  }

  asyncIterator(channel: string): AsyncIterableIterator<unknown> {
    const listeners = this.listeners;
    const queue: unknown[] = [];
    const resolvers: Array<(result: IteratorResult<unknown>) => void> = [];
    let done = false;

    const listener = (payload: unknown) => {
      if (resolvers.length > 0) {
        resolvers.shift()!({ value: payload, done: false });
      } else {
        queue.push(payload);
      }
    };

    if (!listeners.has(channel)) {
      listeners.set(channel, new Set());
    }
    listeners.get(channel)!.add(listener);

    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next(): Promise<IteratorResult<unknown>> {
        if (queue.length > 0) {
          return Promise.resolve({ value: queue.shift()!, done: false });
        }
        if (done) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise((resolve) => {
          resolvers.push(resolve);
        });
      },
      return(): Promise<IteratorResult<unknown>> {
        done = true;
        listeners.get(channel)?.delete(listener);
        if (listeners.get(channel)?.size === 0) {
          listeners.delete(channel);
        }
        return Promise.resolve({ value: undefined, done: true });
      },
      throw(err: unknown): Promise<IteratorResult<unknown>> {
        done = true;
        return Promise.reject(err);
      },
    };
  }
}

// Global pubsub singleton (module-level for SSR)
export const pubsub = new PubSub();

export interface GraphQLContext {
  prisma: typeof prismaClient;
  redis: Redis;
  userId: string | null;
  clientIp: string;
  pubsub: PubSub;
}
