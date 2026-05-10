"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = rateLimit;
const redis_1 = __importDefault(require("./redis"));
/**
 * Sliding-window rate limiter using Redis INCR + EXPIRE.
 *
 * @param key - Unique key for the rate limit scope (e.g., `ratelimit:auth:192.168.1.1`)
 * @param maxAttempts - Maximum number of attempts allowed within the window
 * @param windowSeconds - Duration of the sliding window in seconds
 * @returns Object with `allowed` (boolean) and `remaining` attempts
 */
async function rateLimit(key, maxAttempts, windowSeconds) {
    const current = await redis_1.default.incr(key);
    // Set expiry only on the first increment (when the window starts)
    if (current === 1) {
        await redis_1.default.expire(key, windowSeconds);
    }
    const remaining = Math.max(0, maxAttempts - current);
    return {
        allowed: current <= maxAttempts,
        remaining,
    };
}
