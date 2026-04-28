// instrumentation.ts
// Runs once when Next.js server starts — registers background workers.
// Only executes in the Node.js runtime (not edge, not browser).

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startStaleShardDetector } = await import('@/workers/staleShardDetector');
    startStaleShardDetector();
  }
}
