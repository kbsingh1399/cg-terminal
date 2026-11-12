#!/usr/bin/env node
/**
 * MCP E2E test — spawns mcp/server.mjs against the running terminal and
 * exercises every tool (including the new dimension params), asserting
 * sane responses. Run with the terminal live on 127.0.0.1:3000.
 */
const { spawn } = require("node:child_process");

const TERMINAL = process.env.TERMINAL_URL || "http://127.0.0.1:3000";
const child = spawn("node", ["mcp/server.mjs"], {
  env: { ...process.env, TERMINAL_URL: TERMINAL },
  stdio: ["pipe", "pipe", "pipe"],
});
child.stderr.on("data", (d) => process.stderr.write(`[mcp] ${d}`));

let buf = "";
const pending = new Map();
let nextId = 1;
child.stdout.on("data", (d) => {
  buf += d.toString();
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl);
    buf = buf.slice(nl + 1);
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id != null && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {
      /* ignore */
    }
  }
});

function rpc(method, params, timeoutMs = 150_000) {
  const id = nextId++;
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      pending.delete(id);
      resolve({ timeout: true });
    }, timeoutMs);
    pending.set(id, (msg) => {
      clearTimeout(t);
      resolve(msg);
    });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

const call = (name, args) => rpc("tools/call", { name, arguments: args });

const results = [];
function record(name, ok, note) {
  results.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? " — " + note : ""}`);
}

(async () => {
  const init = await rpc("initialize", { protocolVersion: "2024-11-05" });
  console.log("initialize:", init.result?.serverInfo?.name ?? "FAILED");

  const tl = await rpc("tools/list");
  const names = (tl.result?.tools ?? []).map((t) => t.name);
  console.log("tools/list:", names.join(", "));
  record("tools/list has 16 tools", names.length === 16, `${names.length} tools`);

  const expectOk = async (name, args, check, label) => {
    const r = await call(name, args);
    const err = r.result?.isError;
    const text = r.result?.content?.[0]?.text ?? "";
    if (err || !text) {
      record(label, false, err ? text.slice(0, 200) : "empty text");
      return null;
    }
    const note = check ? check(text) : "";
    record(label, true, note);
    return text;
  };

  await expectOk("list_assets", {}, (t) => t.split("\n")[0].slice(0, 80)); // first line: live-derived count header
  await expectOk("market_snapshot", { sym: "BTC" }, (t) => t.split("\n")[0].slice(0, 90));
  await expectOk("live_price", { sym: "BTC" }, (t) => t.slice(0, 80));
  await expectOk("signals", { sym: "BTC", bt: "all" }, (t) => t.split("\n")[0].slice(0, 90));
  await expectOk("notifications", { limit: 5, advance_cursor: false }, (t) => t.split("\n").slice(-1)[0].slice(0, 70));
  await expectOk("liquidation_levels", { sym: "BTC", range: "3d" }, (t) => t.split("\n")[0].slice(0, 90));
  await expectOk("whale_orders", { sym: "BTC", minUsd: 500000 }, (t) => t.split("\n")[0].slice(0, 90));
  await expectOk("book_walls", { sym: "BTC" }, (t) => t.split("\n")[1].slice(0, 110), "book_walls BTC (defaults)");
  await expectOk("book_walls", { sym: "ETH", interval: "1h", band: 2, limit: 60 }, (t) => t.split("\n")[0].slice(0, 100), "book_walls ETH 1h band2 (new params)"); // band must be route-allowlisted (0.5/1/2/5) — band=3 was silently coerced to 5
  await expectOk("cvd_state", { sym: "BTC", mode: "total", itv: "15m" }, (t) => t.split("\n")[0].slice(0, 100));
  await expectOk("cvd_state", { sym: "ETH", itv: "1h", anchor: "day" }, (t) => t.split("\n")[0].slice(0, 100), "cvd_state ETH 1h anchor=day (new params)");
  await expectOk("stopmap", { sym: "BTC" }, (t) => t.split("\n")[1].slice(0, 110), "stopmap BTC (new tool)");
  await expectOk("footprint", { sym: "ETH", interval: "m15", last: 6 }, (t) => t.split("\n").slice(0, 2).join(" | ").slice(0, 130), "footprint ETH (new tool)");
  await expectOk("footprint", { sym: "ETH", interval: "15m", last: 3 }, (t) => t.split("\n")[0].slice(0, 90), "footprint ETH 15m-alias (route vocabulary is m15)");
  await expectOk("large_orders", { sym: "BTC", hours: 24 }, (t) => t.split("\n")[0].slice(0, 100), "large_orders BTC (new tool)"); // default interval m15 — the old default 15m hit the route's parseInterval 400
  await expectOk("kline_series", { sym: "BTC", type: "oi", interval: "h1", limit: 60 }, (t) => t.split("\n").join(" | ").slice(0, 140), "kline_series OI (new tool)");
  await expectOk("analyze_setup", { sym: "BTC" }, (t) => {
    const secs = (t.match(/--- [A-Z ]+ ---/g) ?? []).length;
    return `${secs} context sections`;
  }, "analyze_setup BTC (now incl. walls + CVD)");

  // graceful failure: stopmap for non-BTC must return isError (upstream limit), not crash
  const st = await call("stopmap", { sym: "ETH" });
  record(
    "stopmap ETH → graceful upstream-limit error",
    !!st.result?.isError && /BTC-only/.test(st.result?.content?.[0]?.text ?? ""),
    (st.result?.content?.[0]?.text ?? "").slice(0, 80)
  );

  // V2 screener + desk tools
  await expectOk("alpha_screener", { mode: "all" }, (t) => t.split("\n")[0].slice(0, 100), "alpha_screener (V2 tool)");
  await expectOk("desk_status", {}, (t) => t.split("\n")[0].slice(0, 100), "desk_status (V2 tool)");

  const fails = results.filter((r) => !r.ok).length;
  console.log(`\n===== ${results.length - fails}/${results.length} passed =====`);
  child.kill();
  process.exit(fails ? 1 : 0);
})();
