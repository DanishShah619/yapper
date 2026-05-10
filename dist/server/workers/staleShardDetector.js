"use strict";
// workers/staleShardDetector.ts
// Background job that scans for stale key shards and alerts room admins.
Object.defineProperty(exports, "__esModule", { value: true });
exports.startStaleShardDetector = startStaleShardDetector;
exports.stopStaleShardDetector = stopStaleShardDetector;
const crypto_1 = require("crypto");
const keyDelivery_1 = require("../lib/keyDelivery");
const redis_1 = require("../lib/redis");
const JOB_INTERVAL_MS = 5 * 60 * 1000;
const LOCK_KEY = 'lock:stale-shard-worker';
const LOCK_TTL_MS = 35000;
const LOCK_RENEWAL_MS = 10000;
const LOCK_VALUE = (0, crypto_1.randomUUID)();
const RENEW_LOCK_SCRIPT = 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end';
const RELEASE_LOCK_SCRIPT = 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';
let intervalId = null;
let signalHandlersRegistered = false;
/** Start the stale shard detection background job. Idempotent. */
function startStaleShardDetector() {
    if (intervalId) {
        console.warn('[StaleDetector] Already running - skipping duplicate start');
        return;
    }
    console.log('[StaleDetector] Starting stale shard detection job (every 5 min)');
    registerSignalHandlers();
    void runDetection();
    intervalId = setInterval(() => {
        void runDetection();
    }, JOB_INTERVAL_MS);
}
/** Stop the background job (useful for tests/graceful shutdown). */
function stopStaleShardDetector() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('[StaleDetector] Stopped');
    }
}
async function runDetection() {
    const lockAcquired = await acquireWorkerLock();
    if (!lockAcquired) {
        console.debug('[worker] lock held by another replica, skipping');
        return;
    }
    const renewalId = startLockRenewal();
    try {
        console.log('[StaleDetector] Scanning for stale shards...');
        await (0, keyDelivery_1.detectAndAlertStaleShards)();
        console.log('[StaleDetector] Scan complete');
    }
    catch (error) {
        console.error('[StaleDetector] Error during scan:', error);
    }
    finally {
        clearInterval(renewalId);
        await releaseWorkerLock();
    }
}
async function acquireWorkerLock() {
    try {
        const result = await redis_1.redis.set(LOCK_KEY, LOCK_VALUE, 'PX', LOCK_TTL_MS, 'NX');
        return result === 'OK';
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[worker] failed to acquire stale-shard lock:', message);
        return false;
    }
}
function startLockRenewal() {
    return setInterval(() => {
        void renewWorkerLock().catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            console.warn('[worker] failed to renew stale-shard lock:', message);
        });
    }, LOCK_RENEWAL_MS);
}
async function renewWorkerLock() {
    await redis_1.redis.eval(RENEW_LOCK_SCRIPT, 1, LOCK_KEY, LOCK_VALUE, String(LOCK_TTL_MS));
}
async function releaseWorkerLock() {
    await redis_1.redis.eval(RELEASE_LOCK_SCRIPT, 1, LOCK_KEY, LOCK_VALUE);
}
function registerSignalHandlers() {
    if (signalHandlersRegistered) {
        return;
    }
    signalHandlersRegistered = true;
    const releaseAndExit = (signal) => {
        void releaseWorkerLock()
            .catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[worker] failed to release stale-shard lock on ${signal}:`, message);
        })
            .finally(() => {
            process.exit(0);
        });
    };
    process.once('SIGTERM', releaseAndExit);
    process.once('SIGINT', releaseAndExit);
}
