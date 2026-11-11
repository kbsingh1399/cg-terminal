#!/usr/bin/env node
/**
 * PROBE 2 — plain-name TRADIFI perps on Binance fapi (prod + testnet) for all
 * 23 kind-B underlyings + ANTHROPIC, and the Coinglass surface for those
 * plain names (kline / bs_usd / orderFlow / liqlevels / lto support + data).
 *
 * Follow-up to probe-cg-btokens.mjs: B-token SPOT pairs (NVDABUSDT) have NO
 * CG kline/orderFlow/liqlevels (20001/40001), but the PLAIN names (NVDA) have
 * real Binance USDT-M TRADIFI_PERPETUALs — this probe maps that surface.
 *
 * Usage: node scripts/probe-btoken-perps.mjs
 * Writes /tmp/btoken-perps.json, prints compact report.
 */
import { writeFileSync } from "fs";

const MAP = {
  NVDAB: "NVDA", SNDKB: "SNDK", SOXLB: "SOXL", SPCXB: "SPCX", MUB: "MU",
  INTCB: "INTC", CRCLB: "CRCL", SKHYB: "SKHY", MSTRB: "MSTR", KORUB: "KORU",
  GOOGLB: "GOOGL", NBISB: "NBIS", TSLAB: "TSLA", METAB: "META", AAPLB: "AAPL",
  DRAMB: "DRAM", MSFTB: "MSFT", AMZNB: "AMZN", AMDB: "AMD", COINB: "COIN",
  NFLXB: "NFLX", AVGOB: "AVGO", TSMB: "TSM",
};

const out = { fapi: {}, cg: {}, _meta: { at: new Date().toISOString() } };

// ---------- fapi prod + testnet ----------
{
  const [prod, test] = await Promise.all([
    (await fetch("https://fapi.binance.com/fapi/v1/exchangeInfo")).json(),
    (await fetch("https://testnet.binancefuture.com/fapi/v1/exchangeInfo")).json().catch(() => ({ symbols: [] })),
  ]);
  const p = new Map(prod.symbols.map((x) => [x.symbol, x]));
  const t = new Map((test.symbols ?? []).map((x) => [x.symbol, x]));
  console.log("== fapi TRADIFI perps for kind-B underlyings (+ANTHROPIC) ==");
  console.log("BASE".padEnd(8), "PROD".padEnd(36), "TESTNET".padEnd(36));
  for (const [b, plain] of Object.entries(MAP)) {
    const pair = `${plain}USDT`;
    const pe = p.get(pair);
    const te = t.get(pair);
    const prodOk = !!(pe && pe.status === "TRADING" && /PERPETUAL$/.test(pe.contractType ?? ""));
    const testOk = !!(te && te.status === "TRADING" && /PERPETUAL$/.test(te.contractType ?? ""));
    out.fapi[b] = {
      plain, pair,
      prod: { listed: prodOk, status: pe?.status ?? null, contractType: pe?.contractType ?? null, onboardDate: pe?.onboardDate ?? null },
      testnet: { listed: testOk, status: te?.status ?? "NOT_LISTED", contractType: te?.contractType ?? null },
    };
    console.log(
      `${b.padEnd(8)} ${(pe ? `${pe.status}/${pe.contractType}` : "not-listed").padEnd(36)} ${(te ? `${te.status}/${te.contractType}` : "not-listed").padEnd(36)}`
    );
  }
  // ANTHROPIC (kind C)
  {
    const pair = "ANTHROPICUSDT";
    const pe = p.get(pair);
    const te = t.get(pair);
    out.fapi.ANTHROPIC = {
      plain: "ANTHROPIC", pair,
      prod: { listed: !!(pe && pe.status === "TRADING" && /PERPETUAL$/.test(pe.contractType ?? "")), status: pe?.status ?? null, contractType: pe?.contractType ?? null, onboardDate: pe?.onboardDate ?? null },
      testnet: { listed: !!(te && te.status === "TRADING"), status: te?.status ?? "NOT_LISTED", contractType: te?.contractType ?? null },
    };
    console.log(
      `ANTHROPIC ${(pe ? `${pe.status}/${pe.contractType}` : "not-listed").padEnd(36)} ${(te ? `${te.status}/${te.contractType}` : "not-listed").padEnd(36)}`
    );
  }
  // live 24h ticker for a couple to prove real liquidity
  for (const pair of ["NVDAUSDT", "ANTHROPICUSDT", "SOXLUSDT", "TSMUSDT", "AMDUSDT"]) {
    const r = await (await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${pair}`)).json();
    console.log(`  24hr ${pair}: last=${r.lastPrice} quoteVol=${r.quoteVolume} trades=${r.count}`);
    if (out.fapi[pair.replace("USDT", "")]) out.fapi[pair.replace("USDT", "")].ticker24h = { last: r.lastPrice, quoteVol: r.quoteVolume, count: r.count };
  }
}

// ---------- Coinglass surface for plain names ----------
// self-contained decrypt port (see scripts/probe-cg-btokens.mjs for provenance)
import crypto from "crypto";
import zlib from "zlib";
const STATIC_KEY = Buffer.from("1f68efd73f8d4921acc0dead41dd39bc", "utf8");
const TOTP_SECRET_B32 = "I65VU7K5ZQL7WB4E";
const KEY_A_CONSTS = { "55": "170b070da9654622", "66": "d6537d845a964081", "77": "863f08689c97435b" };
function base32Decode(s) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0; const outB = [];
  for (const ch of s.toUpperCase().replace(/=+$/, "")) {
    const idx = alphabet.indexOf(ch); if (idx === -1) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { outB.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(outB);
}
function totp(secretB32, t) {
  const key = base32Decode(secretB32);
  const counter = Buffer.alloc(8); counter.writeUInt32BE(Math.floor(t / 30), 4);
  const digest = crypto.createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}
function makeObeToken(nowMs) {
  const secs = Math.floor(nowMs / 1000);
  const plain = Buffer.from(`${secs},${totp(TOTP_SECRET_B32, secs)}`, "utf8");
  const cipher = crypto.createCipheriv("aes-256-ecb", STATIC_KEY, null);
  return Buffer.concat([cipher.update(plain), cipher.final()]).toString("base64");
}
function aesEcbDecryptB64(b64, key) {
  const algo = key.length === 16 ? "aes-128-ecb" : key.length === 24 ? "aes-192-ecb" : "aes-256-ecb";
  const decipher = crypto.createDecipheriv(algo, key, null);
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(Buffer.from(b64, "base64")), decipher.final()]);
}
function tryInflate(buf) {
  for (const fn of [zlib.inflateSync, zlib.inflateRawSync, zlib.gunzipSync]) { try { return fn(buf); } catch {} }
  return buf;
}
function stripQuotes(s) { let o = s; if (o.startsWith('"')) o = o.slice(1); if (o.endsWith('"')) o = o.slice(0, -1); return o; }
function mangleUrl(url) {
  const idx = url.indexOf("/api"); if (idx === -1) return url;
  const q = url.indexOf("?"); return q === -1 ? url.slice(idx) : url.slice(idx, q);
}
function deriveKeyA(v, cacheTs, timeHeader, url) {
  let src;
  if (v === "0") src = cacheTs; else if (v === "2") src = timeHeader ?? ""; else if (v === "1") src = mangleUrl(url); else src = KEY_A_CONSTS[v] ?? "";
  return Buffer.from(Buffer.from(src, "utf8").toString("base64").slice(0, 16), "utf8");
}
function decryptCgResponse(resp, cacheTs, url) {
  const body = JSON.parse(resp.bodyText);
  if (body.code !== "0") throw new Error(`upstream code ${body.code}: ${body.msg ?? "unknown"}`);
  const data = body.data;
  if (typeof data !== "string") return data;
  const userBlob = resp.headers["user"] ?? "";
  const v = String(resp.headers["v"] ?? "0");
  const keyA = deriveKeyA(v, cacheTs, resp.headers["time"] ?? null, url);
  const keyBRaw = stripQuotes(tryInflate(aesEcbDecryptB64(userBlob, keyA)).toString("utf8"));
  const payloadRaw = stripQuotes(tryInflate(aesEcbDecryptB64(data, Buffer.from(keyBRaw, "utf8"))).toString("utf8"));
  try { return JSON.parse(payloadRaw); } catch { return payloadRaw; }
}
async function cgGet(pathAndQuery, host = "https://capi.coinglass.com") {
  const url = `${host}${pathAndQuery}`;
  const cacheTs = String(Date.now());
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Origin: "https://www.coinglass.com", Referer: "https://www.coinglass.com/",
      Accept: "application/json", encryption: "true", "cache-ts-v2": cacheTs, language: "en",
      obe: makeObeToken(Number(cacheTs)),
    },
    cache: "no-store", signal: AbortSignal.timeout(25_000),
  });
  const headers = {}; res.headers.forEach((v, k) => { headers[k] = v; });
  const bodyText = await res.text();
  if (res.status !== 200) return { __http: res.status, __body: bodyText.slice(0, 160) };
  const parsed = JSON.parse(bodyText);
  if (parsed && typeof parsed === "object" && "data" in parsed && typeof parsed.data !== "string") {
    if (parsed.code !== "0" && Number(parsed.code) !== 0) return { __code: parsed.code, __msg: parsed.msg };
    return parsed.data;
  }
  try { return decryptCgResponse({ status: res.status, headers, bodyText }, cacheTs, url); }
  catch (e) { return { __decryptError: e.message, __rawCode: parsed?.code, __rawMsg: parsed?.msg }; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const summarize = (x, n = 160) => { const s = JSON.stringify(x); return s == null ? String(x) : s.length > n ? s.slice(0, n) + `…` : s; };

// probe CG surface for every plain name (all 23 + ANTHROPIC): keep it light —
// kline + orderFlow on the Binance perp key, liqlevels on Binance, lto support
const plains = [...new Set([...Object.values(MAP), "ANTHROPIC"])];
console.log("\n== Coinglass surface for plain-name perps ==");
console.log("NAME".padEnd(10), "kline#kline".padEnd(14), "orderFlow".padEnd(12), "liqLevels".padEnd(12), "bs_usd".padEnd(12), "lto support (fut|spot)");
for (const plain of plains) {
  const key = `Binance_${plain}USDT`;
  const rec = {};
  {
    const r = await cgGet(`/api/v2/kline?symbol=${encodeURIComponent(`${key}#kline`)}&interval=m15&limit=3&minLimit=false`);
    const rows = Array.isArray(r) ? r : r?.data;
    rec.kline = Array.isArray(rows) && rows.length ? { ok: true, rows: rows.length, lastClose: rows[rows.length - 1]?.[4] } : { ok: false, err: r?.__rawMsg ?? r?.__code ?? r?.__msg ?? summarize(r, 80) };
    await sleep(250);
  }
  {
    const r = await cgGet(`/api/orderFlow?symbol=${encodeURIComponent(`${key}#order_flow`)}&interval=m15&minLimit=false&limit=3`);
    const rows = Array.isArray(r) ? r : r?.data;
    rec.orderflow = Array.isArray(rows) && rows.length ? { ok: true, bars: rows.length } : { ok: false, err: r?.__rawMsg ?? r?.__code ?? summarize(r, 80) };
    await sleep(250);
  }
  {
    const r = await cgGet(`/api/liquidationLevels/v2?symbol=${encodeURIComponent(key)}&limit=5&range=3d`);
    const d = r?.data ?? r;
    rec.liqlevels = d && (Array.isArray(d?.prices) || Array.isArray(d)) ? { ok: true } : { ok: false, err: r?.__rawMsg ?? r?.__code ?? summarize(r, 80) };
    await sleep(250);
  }
  {
    const r = await cgGet(`/api/v2/kline?symbol=${encodeURIComponent(`${key}#bs_usd`)}&interval=m15&limit=3&minLimit=false`);
    const rows = Array.isArray(r) ? r : r?.data;
    rec.bs_usd = Array.isArray(rows) && rows.length ? { ok: true, rows: rows.length } : { ok: false, err: r?.__rawMsg ?? r?.__code ?? summarize(r, 80) };
    await sleep(250);
  }
  {
    const r = await cgGet(`/api/largeTakerOrder/support/v3?symbol=${encodeURIComponent(plain)}`, "https://fapi.coinglass.com");
    const has = r && !r.__http && !r.__code && !r.__decryptError;
    rec.lto_support = has ? { ok: true, futures: (r.futures ?? []).map((s) => s.exchange), spot: (r.spot ?? []).map((s) => s.exchange) } : { ok: false, err: summarize(r, 80) };
    await sleep(250);
  }
  out.cg[plain] = rec;
  console.log(
    plain.padEnd(10),
    (rec.kline.ok ? `✓${rec.kline.rows}` : "✗ " + (rec.kline.err ?? "")).padEnd(14),
    (rec.orderflow.ok ? `✓${rec.orderflow.bars}` : "✗ " + (rec.orderflow.err ?? "")).padEnd(12),
    (rec.liqlevels.ok ? "✓" : "✗").padEnd(12),
    (rec.bs_usd.ok ? `✓${rec.bs_usd.rows}` : "✗").padEnd(12),
    rec.lto_support.ok ? `fut=[${rec.lto_support.futures}] spot=[${rec.lto_support.spot}]` : `✗ ${rec.lto_support.err ?? ""}`
  );
}

// ---------- lto v3 ACTUAL data (support listed ≠ orders exist) ----------
console.log("\n== lto v3 actual data ==");
for (const [sym, market] of [["NVDAB", "spot"], ["NVDAB", "all"], ["NVDA", "all"], ["ANTHROPIC", "all"]]) {
  const r = await cgGet(`/api/largeTakerOrder/v3?exchange=Binance&symbol=${encodeURIComponent(sym)}&market=${market}&limit=100&minVolUsd=0`, "https://fapi.coinglass.com");
  const arr = Array.isArray(r) ? r : null;
  const groups = arr?.map((g) => `${g.instrument?.exName}_${g.instrument?.instrumentId}:${g.list?.length ?? 0}orders`) ?? [];
  console.log(`  lto v3 symbol=${sym} market=${market} → ${arr ? `OK ${arr.length} groups: ${groups.slice(0, 4).join(", ")}` : `NO — ${summarize(r)}`}`);
  await sleep(300);
}

writeFileSync("/tmp/btoken-perps.json", JSON.stringify(out, null, 2));
console.log("\nwrote /tmp/btoken-perps.json");
