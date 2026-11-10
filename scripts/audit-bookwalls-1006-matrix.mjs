#!/usr/bin/env node
/**
 * AUDIT script 2 — venue-support matrix for the Coinglass aggregate
 * liquidity-heatmap stream. Determines exactly which (coin, venue) pairs the
 * /aggregate/stream endpoint supports, so AGG_VENUES can be fixed per asset.
 *
 * Usage: node scripts/audit-bookwalls-1006-matrix.mjs
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const STREAM_URL =
  "https://capi.coinglass.com/liquidity-heatmap/api/liquidity/heatmap/aggregate/stream";

async function probeOnce({ coin, exchanges, market = "futures", interval = "m15", limit = 30 }, timeoutMs = 90_000) {
  const q = new URLSearchParams({
    coin,
    exchanges: exchanges.join(","),
    market,
    interval,
    limit: String(limit),
    batchSize: "10",
    endTime: String(Math.floor(Date.now() / 1000)),
  });
  const ctrl = new AbortController();
  const kill = setTimeout(() => ctrl.abort(), timeoutMs);
  let rows = 0;
  let verdict = null;
  let frame1 = "";
  try {
    const res = await fetch(STREAM_URL + "?" + q.toString(), {
      headers: {
        "User-Agent": UA,
        Origin: "https://www.coinglass.com",
        Referer: "https://www.coinglass.com/",
        Accept: "*/*",
        language: "en",
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!/ndjson/.test(res.headers.get("content-type") || "")) {
      const t = await res.text().catch(() => "");
      return { code: `HTTP ${res.status}`, msg: t.slice(0, 120), rows: 0, frame1: t.slice(0, 160) };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const handle = (line) => {
      if (!line) return;
      let f;
      try { f = JSON.parse(line); } catch { return; }
      if (!frame1) frame1 = JSON.stringify(f).slice(0, 160);
      if (f.type === "meta") verdict = { code: String(f.code), msg: f.msg ?? "" };
      else if (f.type === "batch" || f.type === "data") rows += f.type === "batch" ? (f.data ?? []).length : 1;
      else if (f.type === "error") verdict = verdict?.code === "0" ? verdict : { code: String(f.code), msg: f.msg ?? "" };
    };
    for (;;) {
      const { done, value } = await reader.read();
      buf += dec.decode(value ?? new Uint8Array(), { stream: !done });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) { handle(buf.slice(0, nl)); buf = buf.slice(nl + 1); }
      if (done) break;
    }
    handle(buf.trim());
    return { ...(verdict ?? { code: "?", msg: "" }), rows, frame1 };
  } catch (e) {
    return { code: "throw", msg: e?.message ?? String(e), rows, frame1 };
  } finally {
    clearTimeout(kill);
  }
}

const CASES = [
  // per-venue singles for XRP — which venues carry the XRP futures heatmap?
  { id: "XRP  Gate only", args: { coin: "XRP", exchanges: ["Gate"] } },
  { id: "XRP  Bitget only", args: { coin: "XRP", exchanges: ["Bitget"] } },
  { id: "XRP  Hyperliquid only", args: { coin: "XRP", exchanges: ["Hyperliquid"] } },
  { id: "XRP  Binance+Gate", args: { coin: "XRP", exchanges: ["Binance", "Gate"] } },
  { id: "XRP  Binance+Hyperliquid", args: { coin: "XRP", exchanges: ["Binance", "Hyperliquid"] } },
  { id: "XRP  Binance only, h4", args: { coin: "XRP", exchanges: ["Binance"], interval: "h4" } },
  // ETH control (FAQ says BTC+ETH aggregates cover all 5 venues)
  { id: "ETH  AGG set A", args: { coin: "ETH", exchanges: ["Binance", "OKX", "Gate", "Bitget", "Hyperliquid"] } },
  // metals on their viable perp venues
  { id: "XAU  Binance only", args: { coin: "XAU", exchanges: ["Binance"] } },
  { id: "XAG  Binance only", args: { coin: "XAG", exchanges: ["Binance"] } },
  // repeat of set A for XRP to observe error-frame variability (1006 vs 20001?)
  { id: "XRP  AGG set A (repeat)", args: { coin: "XRP", exchanges: ["Binance", "OKX", "Gate", "Bitget", "Hyperliquid"] } },
];

for (const c of CASES) {
  const r = await probeOnce({ ...c.args, market: "futures", limit: 30 });
  console.log(
    `${c.id.padEnd(30)} → code=${String(r.code).padEnd(6)} rows=${String(r.rows).padEnd(4)} msg=${JSON.stringify(r.msg).slice(0, 70)}`
  );
  if (String(r.code) !== "0") console.log(`   frame1: ${r.frame1}`);
}
