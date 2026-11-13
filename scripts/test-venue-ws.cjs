#!/usr/bin/env node
/**
 * Probe multiple venues' public WS from this host to isolate whether the
 * frame-drop is Binance-specific or sandbox-wide. 25s window each.
 */
function probe(name, url, subMsg, ms = 25_000) {
  return new Promise((res) => {
    let n = 0, first = null, closed = null;
    const ws = new WebSocket(url);
    const done = () => { try { ws.close(); } catch {} res({ name, n, first, closed }); };
    ws.onopen = () => {
      if (subMsg) ws.send(JSON.stringify(subMsg));
    };
    ws.onmessage = (ev) => {
      n++;
      if (n === 1) first = String(ev.data).slice(0, 200);
      if (n === 3) done();
    };
    ws.onclose = (e) => { closed = e.code; };
    setTimeout(done, ms);
  });
}

(async () => {
  const out = await Promise.all([
    probe("binance-spot", "wss://stream.binance.com:9443/ws/btcusdt@trade", null),
    probe("okx", "wss://ws.okx.com:8443/ws/v5/public", { op: "subscribe", args: [{ channel: "trades", instId: "BTC-USDT-SWAP" }] }),
    probe("bybit", "wss://stream.bybit.com/v5/public/linear", { op: "subscribe", args: ["publicTrade.BTCUSDT"] }),
    probe("hyperliquid", "wss://api.hyperliquid.xyz/ws", { op: "subscribe", sub: { type: "allMids" } }),
    probe("deribit", "wss://www.deribit.com/ws/api/v2", { jsonrpc: "2.0", id: 1, method: "public/subscribe", params: { channels: ["ticker BTC-PERPETUAL.raw"] } }),
  ]);
  for (const r of out) {
    console.log(`\n=== ${r.name}: ${r.n} frames ${r.closed ? "closed:" + r.closed : ""}`);
    if (r.first) console.log("  first:", r.first);
  }
  process.exit(0);
})();
