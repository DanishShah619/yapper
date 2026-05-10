"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSession = setSession;
exports.getSession = getSession;
exports.deleteSession = deleteSession;
const redis_1 = __importDefault(require("./redis"));
const crypto_1 = require("crypto");
const SESSION_PREFIX = 'session:';
function sessionKey(userId, token) {
    const tokenHash = (0, crypto_1.createHash)('sha256').update(token).digest('hex');
    return `${SESSION_PREFIX}${userId}:${tokenHash}`;
}
function legacySessionKey(userId) {
    return `${SESSION_PREFIX}${userId}`;
}
/**
 * Cache a JWT session in Redis.
 * TTL in seconds (default 7 days = 604800).
 *
 * Sessions are keyed by token hash so one user can stay logged in on multiple
 * devices without newer logins invalidating older devices.
 */
async function setSession(userId, token, ttlSeconds = 604800) {
    await redis_1.default.set(sessionKey(userId, token), 'active', 'EX', ttlSeconds);
}
/**
 * Retrieve a cached session token for a user.
 * Returns null if expired or not found.
 */
async function getSession(userId, token) {
    const activeSession = await redis_1.default.get(sessionKey(userId, token));
    if (activeSession)
        return token;
    // Backward compatibility for tokens created before multi-device sessions.
    const legacyToken = await redis_1.default.get(legacySessionKey(userId));
    return legacyToken === token ? legacyToken : null;
}
/**
 * Delete a session. When a token is supplied, only that device/session is
 * logged out. Without a token, only the legacy single-session key is removed.
 */
async function deleteSession(userId, token) {
    if (token) {
        await redis_1.default.del(sessionKey(userId, token));
        return;
    }
    await redis_1.default.del(legacySessionKey(userId));
}
