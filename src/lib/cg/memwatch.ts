/**
 * Server-only memory watchdog (2026-11-11 postmortem).
 *
 * The terminal's continuity engine polls upstream 24/7 on a small box; a past
 * build leaked to ~2GB until the kernel OOM-killed the server with no trace
 * in the app log (and the platform's boot dev server was down for hours
 * before anyone noticed). This module logs RSS/heap every 5 minutes so
 * growth is visible in dev.log / prod.log, and warns loudly when crossing
 * the soft threshold well before the 4GB box limit.
 *
 * Lives in lib (imported only by the server-side engine) — NOT in
 * instrumentation.ts, because Next bundles that file for the Edge runtime
 * too and process.memoryUsage() there produces build warnings.
 */

interface MemWatchState {
  started: boolean;
}

const g = globalThis as unknown as { __cgMemWatch?: MemWatchState };
const S: MemWatchState = (g.__cgMemWatch ??= { started: false });

export function startMemWatch(): void {
  if (S.started) return;
  S.started = true;
  const log = () => {
    const m = process.memoryUsage();
    const rss = Math.round(m.rss / 1048576);
    const line = `[health] rss=${rss}MB heap=${Math.round(m.heapUsed / 1048576)}/${Math.round(m.heapTotal / 1048576)}MB ext=${Math.round(m.external / 1048576)}MB uptime=${Math.round(process.uptime())}s`;
    if (rss > 2500) console.warn(line + "  SOFT LIMIT EXCEEDED - investigate memory growth");
    else console.log(line);
  };
  log();
  setInterval(log, 5 * 60_000).unref?.();
}
