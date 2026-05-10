// workers/staleShardDetector.ts
// Background job that scans for stale key shards and alerts room admins.

import { randomUUID } from 'crypto';
import { detectAndAlertStaleShards } from '../lib/keyDelivery';
import { redis } from '../lib/redis';

const JOB_INTERVAL_MS = 5 * 60 * 1000;
const LOCK_KEY = 'lock:stale-shard-worker';
const LOCK_TTL_MS = 35000;
const LOCK_RENEWAL_MS = 10000;
const LOCK_VALUE = randomUUID();
const RENEW_LOCK_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end';
const RELEASE_LOCK_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

let intervalId: NodeJS.Timeout | null = null;
let signalHandlersRegistered = false;

/** Start the stale shard detection background job. Idempotent. */
export function startStaleShardDetector(): void {
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
export function stopStaleShardDetector(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[StaleDetector] Stopped');
  }
}

async function runDetection(): Promise<void> {
  const lockAcquired = await acquireWorkerLock();
  if (!lockAcquired) {
    console.debug('[worker] lock held by another replica, skipping');
    return;
  }

  const renewalId = startLockRenewal();

  try {
    console.log('[StaleDetector] Scanning for stale shards...');
    await detectAndAlertStaleShards();
    console.log('[StaleDetector] Scan complete');
  } catch (error) {
    console.error('[StaleDetector] Error during scan:', error);
  } finally {
    clearInterval(renewalId);
    await releaseWorkerLock();
  }
}

async function acquireWorkerLock(): Promise<boolean> {
  try {
    const result = await redis.set(LOCK_KEY, LOCK_VALUE, 'PX', LOCK_TTL_MS, 'NX');
    return result === 'OK';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[worker] failed to acquire stale-shard lock:', message);
    return false;
  }
}

function startLockRenewal(): NodeJS.Timeout {
  return setInterval(() => {
    void renewWorkerLock().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[worker] failed to renew stale-shard lock:', message);
    });
  }, LOCK_RENEWAL_MS);
}

async function renewWorkerLock(): Promise<void> {
  await redis.eval(RENEW_LOCK_SCRIPT, 1, LOCK_KEY, LOCK_VALUE, String(LOCK_TTL_MS));
}

async function releaseWorkerLock(): Promise<void> {
  await redis.eval(RELEASE_LOCK_SCRIPT, 1, LOCK_KEY, LOCK_VALUE);
}

function registerSignalHandlers(): void {
  if (signalHandlersRegistered) {
    return;
  }
  signalHandlersRegistered = true;

  const releaseAndExit = (signal: NodeJS.Signals) => {
    void releaseWorkerLock()
      .catch((error: unknown) => {
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
