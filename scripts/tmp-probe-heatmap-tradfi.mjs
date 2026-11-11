// quick probe: does the liquidity-heatmap aggregate stream carry TradFi coins?
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function stream(coin, exchanges, market = "futures") {
  const q = new URLSearchParams({
    coin,
    exchanges: exchanges.join(","),
    market,
    interval: "m15",
    limit: "5",
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
      const text = (await res.text()).slice(0, 220);
      return { ok: false, note: `not-ndjson (${ct}) ${text}` };
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
    return { ok: meta && String(meta.code) === "0" && rows > 0, rows, size: meta?.size, code: meta?.code, errLine };
  } catch (e) {
    return { ok: false, note: String(e?.message ?? e).slice(0, 200) };
  } finally {
    clearTimeout(kill);
  }
}

const FULL = ["Binance", "OKX", "Gate", "Bitget", "Hyperliquid"];
const cases = [
  ["BTC", FULL],
  ["NVDA", ["Binance"]],
  ["NVDA", FULL],
  ["XAU", FULL],
  ["XAG", FULL],
  ["CL", FULL],
  ["ANTHROPIC", FULL],
  ["SOXL", FULL],
  ["SPCX", FULL],
  ["DRAM", FULL],
  ["KORU", FULL],
  ["SNDK", FULL],
  ["SKHY", FULL],
  ["1000PEPE", FULL],
  ["TIA", FULL],
  ["VET", FULL],
];
for (const [coin, exs] of cases) {
  const r = await stream(coin, exs);
  console.log(`${coin.padEnd(11)} [${exs.join(",")}] ->`, JSON.stringify(r));
  await new Promise((r2) => setTimeout(r2, 400));
}
