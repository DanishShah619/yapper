"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pubsub = void 0;
const ioredis_1 = require("ioredis");
const env_1 = require("../lib/env");
const graphql_redis_subscriptions_1 = require("graphql-redis-subscriptions");
const REDIS_URL = env_1.env.REDIS_URL;
const redisConfig = {
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 50, 2000),
};
function createPubSubRedisClient(role) {
    const client = new ioredis_1.Redis(REDIS_URL, redisConfig);
    client.on('error', (error) => {
        console.warn(`[RedisPubSub] ${role} connection error:`, error.message);
    });
    return client;
}
exports.pubsub = new graphql_redis_subscriptions_1.RedisPubSub({
    publisher: createPubSubRedisClient('publisher'),
    subscriber: createPubSubRedisClient('subscriber'),
});
