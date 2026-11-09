/**
 * Next.js instrumentation hook — starts the continuity engine once per
 * server process. The engine:
 *   1. backfills every series from its last stored timestamp (endTime
 *      pagination against the Coinglass API), then
 *   2. polls and appends only new rows, deduped by the local store.
 * Disable with CG_ENGINE=off. Data lands in data/cg-series/*.jsonl.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.CG_ENGINE === "off") return;
  try {
    const { ensureEngine } = await import("@/lib/cg/engine");
    ensureEngine();
    console.log("[cg-engine] continuity engine started (backfill + poll)");
  } catch (e) {
    console.warn("[cg-engine] failed to start:", e instanceof Error ? e.message : e);
  }
}
