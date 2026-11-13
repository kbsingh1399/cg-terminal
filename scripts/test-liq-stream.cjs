#!/usr/bin/env node
/**
 * Differential diagnosis: which Binance futures WS streams deliver frames
 * from this host? Tests in parallel for 120s:
 *   A) btcusdt@aggTrade   — baseline frame flow (should be busy)
 *   B) !forceOrder@arr    — all-market liquidations
 *   C) btcusdt@forceOrder — per-pair liquidations
 */
function probe(name, url, ms) {
  return new Promise((res) => {
    let n = 0, first = null, err = null;
    const ws = new WebSocket(url);
    const done = () => {
      try { ws.close(); } catch {}
      res({ name, n, first, err });
    };
    ws.onopen = () => {};
    ws.onmessage = (ev) => {
      n++;
      if (n === 1) first = ev.data.slice(0, 220);
      if (n === 3) done(); // got 3 frames — enough
    };
    ws.onerror = () => { err = "error"; };
    ws.onclose = (e) => { if (!err) err = `close ${e.code}`; };
    setTimeout(done, ms);
  });
}

(async () => {
  const out = await Promise.all([
    probe("aggTrade", "wss://fstream.binance.com/ws/btcusdt@aggTrade", 30_000),
    probe("forceOrder-all", "wss://fstream.binance.com/ws/!forceOrder@arr", 120_000),
    probe("forceOrder-btc", "wss://fstream.binance.com/ws/btcusdt@forceOrder", 120_000),
  ]);
  for (const r of out) {
    console.log(`\n=== ${r.name}: ${r.n} frames in window ${r.err ? "ERR:" + r.err : ""}`);
    if (r.first) console.log("first frame:", r.first);
  }
  process.exit(0);
})();
