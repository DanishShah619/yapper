"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
const globalForRedis = globalThis;
function createRedisClient() {
    const client = new ioredis_1.default(env_1.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            const delay = Math.min(times * 200, 2000);
            return delay;
        },
        lazyConnect: true,
    });
    client.on('error', (err) => {
        console.error('[Redis] Connection error:', err.message);
    });
    client.on('connect', () => {
        // Use structured logging in production; avoid console.log
        if (env_1.env.NODE_ENV !== 'production') {
            console.info('[Redis] Connected');
        }
    });
    return client;
}
exports.redis = (_a = globalForRedis.redis) !== null && _a !== void 0 ? _a : createRedisClient();
if (env_1.env.NODE_ENV !== 'production')
    globalForRedis.redis = exports.redis;
exports.default = exports.redis;
