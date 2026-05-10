"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.verifyRedisConnection = verifyRedisConnection;
require("dotenv/config");
const ioredis_1 = __importDefault(require("ioredis"));
const rawNodeEnv = process.env.NODE_ENV;
const NODE_ENV = rawNodeEnv === 'production' || rawNodeEnv === 'test' ? rawNodeEnv : 'development';
const requiredInProduction = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'NEXT_PUBLIC_LIVEKIT_URL',
    'APP_ORIGIN',
];
if (NODE_ENV === 'production') {
    const missing = requiredInProduction.filter((name) => { var _a; return !((_a = process.env[name]) === null || _a === void 0 ? void 0 : _a.trim()); });
    if (missing.length > 0) {
        throw new Error(`[env] Missing required production environment variables: ${missing.join(', ')}`);
    }
}
exports.env = {
    NODE_ENV,
    PORT: ((_a = process.env.PORT) === null || _a === void 0 ? void 0 : _a.trim()) || '3000',
    DATABASE_URL: ((_b = process.env.DATABASE_URL) === null || _b === void 0 ? void 0 : _b.trim()) || '',
    REDIS_URL: ((_c = process.env.REDIS_URL) === null || _c === void 0 ? void 0 : _c.trim()) ||
        (NODE_ENV === 'production' ? '' : 'redis://localhost:6379'),
    JWT_SECRET: ((_d = process.env.JWT_SECRET) === null || _d === void 0 ? void 0 : _d.trim()) || '',
    JWT_EXPIRES_IN: ((_e = process.env.JWT_EXPIRES_IN) === null || _e === void 0 ? void 0 : _e.trim()) || '7d',
    LIVEKIT_URL: ((_f = process.env.LIVEKIT_URL) === null || _f === void 0 ? void 0 : _f.trim()) ||
        (NODE_ENV === 'production' ? '' : 'ws://localhost:7880'),
    LIVEKIT_API_KEY: ((_g = process.env.LIVEKIT_API_KEY) === null || _g === void 0 ? void 0 : _g.trim()) || '',
    LIVEKIT_API_SECRET: ((_h = process.env.LIVEKIT_API_SECRET) === null || _h === void 0 ? void 0 : _h.trim()) || '',
    NEXT_PUBLIC_LIVEKIT_URL: ((_j = process.env.NEXT_PUBLIC_LIVEKIT_URL) === null || _j === void 0 ? void 0 : _j.trim()) ||
        (NODE_ENV === 'production' ? '' : 'ws://localhost:7880'),
    APP_ORIGIN: ((_k = process.env.APP_ORIGIN) === null || _k === void 0 ? void 0 : _k.trim()) ||
        (NODE_ENV === 'production' ? '' : 'http://localhost:3000'),
};
async function verifyRedisConnection() {
    const client = new ioredis_1.default(exports.env.REDIS_URL, {
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`[startup] Redis PING failed: ${message}`);
    }
    finally {
        client.disconnect();
    }
}
