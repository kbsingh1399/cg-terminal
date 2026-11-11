// probe: which venues does the heatmap stream support per TradFi coin (discovery walk)?
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function stream(coin, exchanges) {
  const q = new URLSearchParams({
    coin,
    exchanges: exchanges.join(","),
    market: "futures",
    interval: "m15",
    limit: "3",
    batchSize: "10",
    endTime: String(Math.floor(Date.now() / 1000)),
  });
  const url = `https://capi.coinglass.com/liquidity-heatmap/api/liquidity/heatmap/aggregate/stream?${q.toString()}`;
  const ctrl = new AbortController();
  const kill = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Origin: "https://www.coinglass.com", Referer: "https://www.coinglass.com/", Accept: "*/*", language: "en" },
      signal: ctrl.signal,
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!/ndjson/.test(ct)) {
      const text = (await res.text()).slice(0, 200);
      return { ok: false, note: `not-ndjson ${text}` };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let rows = 0, meta = null, errLine = null, buf = "";
    const handle = (line) => {
      if (!line) return;
      const f = JSON.parse(line);
      if (f.type === "meta") meta = f;
      else if (f.type === "batch") rows += (f.data ?? []).length;
      else if (f.type === "data") rows += 1;
      else if (f.type === "error") errLine = `${f.code}: ${f.msg ?? ""}`;
    };
    for (;;) {
      const { done, value } = await reader.read();
      buf += dec.decode(value ?? new Uint8Array(), { stream: !done });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) { handle(buf.slice(0, nl)); buf = buf.slice(nl + 1); }
      if (done) break;
    }
    handle(buf.trim());
    return { ok: !!(meta && String(meta.code) === "0" && rows > 0), rows, size: meta?.size, errLine };
  } catch (e) {
    return { ok: false, note: String(e?.message ?? e).slice(0, 160) };
  } finally {
    clearTimeout(kill);
  }
}

// mimic fetchAggregateWithDiscovery: drop named venue on 20001, retry
async function discover(coin, seed) {
  let venues = [...seed];
  const dropped = [];
  for (let i = 0; i < 8; i++) {
    const r = await stream(coin, venues);
    if (r.ok) return { venues, dropped, rows: r.rows };
    const m = /No supported futures heatmap pair for \S+ on (\w+)/.exec(r.errLine ?? "");
    if (!m) return { venues, dropped, fail: r.note ?? r.errLine ?? "unknown" };
    dropped.push(m[1]);
    const next = venues.filter((v) => v !== m[1]);
    if (next.length === venues.length) return { venues, dropped, fail: r.errLine };
    venues = next;
  }
  return { venues, dropped, fail: "loop" };
}

const SEED = ["Binance", "OKX", "Gate", "Bitget", "Hyperliquid"];
for (const coin of ["NVDA", "XAU", "XAG", "CL", "ANTHROPIC", "DRAM", "KORU", "SPCX", "1000PEPE", "TIA", "VET", "SUI", "SEI", "INJ"]) {
  const r = await discover(coin, SEED);
  console.log(coin.padEnd(11), "->", JSON.stringify(r));
  await new Promise((r2) => setTimeout(r2, 300));
}
