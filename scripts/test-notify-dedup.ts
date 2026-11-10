/**
 * Notify dedup regression test — the P0 from the external AI review:
 * "4 distinct $10M+ whale walls at different prices → 1 emitted, 3 dropped".
 * Imports the REAL notify.ts (Node 24 type stripping) with an isolated
 * CG_DATA_DIR. PASS = all 4 walls emit + exact-duplicate still deduped.
 */
process.env.CG_DATA_DIR = "/tmp/notify-test-data";
import fs from "node:fs";
fs.rmSync("/tmp/notify-test-data", { recursive: true, force: true });

const { emit, listFeed } = await import("../src/lib/cg/notify.ts");

const mk = (price, ts = Date.now()) => ({
  ts,
  asset: "BTC",
  source: "whale-orders",
  kind: "whale_wall",
  dir: "bullish",
  severity: "high",
  title: `BTC whale bid wall @ ${price}`,
  detail: "test wall",
  price,
});

let pass = true;
const check = (name, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) pass = false; };

// scenario 1: 4 distinct walls at different prices in one scan burst
const walls = [109000, 109250, 107500, 111000].map((p) => mk(p));
const emitted = walls.map((w) => emit(w) !== null);
check("4 distinct whale walls all emit (was: 1 emitted, 3 dropped)", emitted.filter(Boolean).length === 4);

// scenario 2: the SAME wall replayed within 30 min is still deduped
const again = emit(mk(109000));
check("exact-duplicate wall (same price) still deduped within 30 min", again === null);

// scenario 3: sweep setups at two different clusters both emit
const sweep = (price) => ({
  ts: Date.now(), asset: "ETH", source: "liqlevels", kind: "sweep_setup",
  dir: "bearish", severity: "high", title: "ETH short cluster", detail: "test", price,
});
check("2 distinct sweep clusters both emit (was: 1 emitted, 1 dropped)",
  emit(sweep(3550)) !== null && emit(sweep(3410)) !== null);

// scenario 4: replayed sweep at same cluster deduped
check("replayed sweep at same cluster deduped", emit(sweep(3550)) === null);

// scenario 5: footprint-style signal with barTs at same bar replayed → deduped
const sig = (ts) => ({
  ts: Date.now(), asset: "BTC", source: "footprint", kind: "abs", dir: "bullish",
  severity: "high", title: "absorption", detail: "test", price: 109000, barTs: ts, barType: "time",
});
check("signal replay (same barTs+price) deduped", emit(sig(1794000000)) !== null && emit(sig(1794000000)) === null);

const feed = listFeed({ limit: 100 });
check("feed holds all unique events", feed.length === 4 + 2 + 1);
console.log(`\nfeed: ${feed.length} events across sources:`, [...new Set(feed.map((n) => n.source))]);
console.log(pass ? "\nALL TESTS PASS" : "\nTESTS FAILED");
process.exit(pass ? 0 : 1);
