#!/usr/bin/env node
/**
 * Verify Bybit + OKX liquidation WS channels deliver frames from this host.
 * Bybit v5 public/linear: {op:subscribe, args:["liquidation.BTCUSDT", ...]}
 * OKX v5 public: {op:subscribe, args:[{channel:"liquidations", instId:"BTC-USDT-SWAP"}]}
 */
function probe(name, url, subs, ms) {
  return new Promise((res) => {
    let n = 0, opened = false;
    const samples = [];
    const ws = new WebSocket(url);
    const done = () => { try { ws.close(); } catch {} res({ name, opened, n, samples }); };
    ws.onopen = () => { opened = true; for (const s of subs) ws.send(JSON.stringify(s)); };
    ws.onmessage = (ev) => {
      const t = String(ev.data);
      let j = null;
      try { j = JSON.parse(t); } catch {}
      // Bybit sends ping as text "ping"
      if (t === "ping") { ws.send("pong"); return; }
      if (j && (j.event === "subscribe" || j.event === "notice" || j.connId)) return;
      if (j && j.arg && String(j.arg.channel).startsWith("liquidation")) {
        n++;
        if (samples.length < 6) samples.push(t.slice(0, 260));
      } else if (j && Array.isArray(j.data) && j.arg && j.arg.channel === "liquidations") {
        n++;
        if (samples.length < 6) samples.push(t.slice(0, 260));
      }
    };
    ws.onclose = (e) => { if (!opened) res({ name, opened: false, n, closeCode: e.code, samples }); };
    setTimeout(done, ms);
  });
}

const BYBIT_SYMS = ["BTCUSDT","ETHUSDT","SOLUSDT","XRPUSDT","DOGEUSDT","1000PEPEUSDT"];
(async () => {
  const [bybit, okx] = await Promise.all([
    probe(
      "bybit-liquidation",
      "wss://stream.bybit.com/v5/public/linear",
      [{ op: "subscribe", args: BYBIT_SYMS.map((s) => `liquidation.${s}`) }],
      150_000
    ),
    probe(
      "okx-liquidations",
      "wss://ws.okx.com:8443/ws/v5/public",
      [
        { op: "subscribe", args: [{ channel: "liquidations", instId: "BTC-USDT-SWAP" }] },
        { op: "subscribe", args: [{ channel: "liquidations", instId: "ETH-USDT-SWAP" }] },
        { op: "subscribe", args: [{ channel: "liquidations", instId: "SOL-USDT-SWAP" }] },
      ],
      150_000
    ),
  ]);
  for (const r of [bybit, okx]) {
    console.log(`\n=== ${r.name}: opened=${r.opened} frames=${r.n}${r.closeCode ? " close=" + r.closeCode : ""}`);
    for (const s of r.samples) console.log("  ", s);
  }
  process.exit(0);
})();
