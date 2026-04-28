// workers/staleShardDetector.ts
// ─────────────────────────────────────────────────────────────────────────────
// Background job that runs every 5 minutes.
// Scans for shards PENDING or DELIVERED for too long and alerts room admins
// via Socket.IO.
//
// Registration: imported by instrumentation.ts (Next.js 14 App Router).
// Never call detectAndAlertStaleShards() inside a request handler.
// ─────────────────────────────────────────────────────────────────────────────

import { detectAndAlertStaleShards } from '@/lib/keyDelivery';

const JOB_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let intervalId: NodeJS.Timeout | null = null;

/** Start the stale shard detection background job. Idempotent. */
export function startStaleShardDetector(): void {
  if (intervalId) {
    console.warn('[StaleDetector] Already running — skipping duplicate start');
    return;
  }

  console.log('[StaleDetector] Starting stale shard detection job (every 5 min)');

  // Run immediately on startup, then on interval
  runDetection();
  intervalId = setInterval(runDetection, JOB_INTERVAL_MS);
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
  try {
    console.log('[StaleDetector] Scanning for stale shards...');
    await detectAndAlertStaleShards();
    console.log('[StaleDetector] Scan complete');
  } catch (err) {
    // Never let the job crash — log and continue
    console.error('[StaleDetector] Error during scan:', err);
  }
}
