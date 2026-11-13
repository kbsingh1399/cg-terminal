/**
 * MT5 asset-list full confluence scan (desk/TRADE_FORMULATION_MANUAL.md v1.1.0).
 *
 * Unlike scan_all_mt5_assets.cjs (which needs the live MT5 spread feed), this
 * scanner walks the FULL MT5 symbol map from desk/state.json so it runs even
 * when the MT5 bridge is offline (Windows-only). Spread gate is marked "gate
 * off — verify in MT5 before sending" per manual D15.
 *
 * Gates applied (manual §1, §3, D16):
 *   - LSR Magnet Gate: LSR >= 2.5 => passive entries banned (S3/S2), S1 only
 *   - Desk R-standard: >= 2.0R to T1 (continuation); 1.5R floor = 40/40/20 composite
 *   - Chase guard: |z| >= 2.0 bans chase entries (plan carries the veto already)
 *   - Freshness: stale telemetry downgrades the candidate
 */
const fs = require('fs');

const BASE = 'http://127.0.0.1:3000';
const TIMEOUT_MS = 30000;

function fetchJson(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  return fetch(url, { signal: ctl.signal })
    .then(r => r.json())
    .finally(() => clearTimeout(t));
}

function fmt(n, d = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

async function main() {
  const state = JSON.parse(fs.readFileSync('desk/state.json', 'utf8'));
  const symbolMap = state.config.symbol_map; // asset -> MT5 symbol
  const assets = Object.keys(symbolMap);

  // current open positions (max 4 concurrent per desk config)
  const openSyms = (state.positions || []).map(p => p.sym);

  console.log(`Scanning ${assets.length} MT5-map assets: ${assets.join(', ')}\n`);
  console.log(`Open positions: ${openSyms.length ? openSyms.join(', ') : 'none'} (${openSyms.length}/4 slots used)\n`);

  const results = [];
  const queue = [...assets];

  async function scanOne(sym) {
    const mt5Sym = symbolMap[sym];
    try {
      const [nar, mkt, liq, qnt] = await Promise.all([
        fetchJson(`${BASE}/api/cg/narrative?sym=${sym}`).catch(() => null),
        fetchJson(`${BASE}/api/cg/market?sym=${sym}`).catch(() => null),
        fetchJson(`${BASE}/api/cg/liqlevels?sym=${sym}&range=3d`).catch(() => null),
        fetchJson(`${BASE}/api/cg/quant?sym=${sym}`).catch(() => null),
      ]);
      if (!nar || !nar.ok) {
        results.push({ asset: sym, mt5Sym, supported: false, note: nar?.error || 'narrative unavailable' });
        return;
      }

      const price = mkt?.price?.last || null;
      const chgDay = mkt?.price?.chgDayPct ?? null;
      const h4Ema13 = mkt?.ema?.h4?.e13;
      const h4Ema89 = mkt?.ema?.h4?.e89;
      const h4Trend = (h4Ema13 && h4Ema89) ? (h4Ema13 > h4Ema89 ? 'UP' : 'DOWN') : 'FLAT';

      const liqStats = liq?.stats || {};
      const shortsAbove = liqStats.totals?.shorts || 0;
      const longsBelow = liqStats.totals?.longs || 0;
      const lsr = longsBelow > 0 && shortsAbove > 0 ? (shortsAbove / longsBelow) : null;
      const magnetDominant = lsr === null ? null : (lsr >= 1 ? 'SHORTS-ABOVE' : 'LONGS-BELOW');
      const lsrAbs = lsr === null ? null : Math.max(shortsAbove, longsBelow) / Math.min(shortsAbove, longsBelow);

      // funding (first venue rate8h as proxy)
      const fund = qnt?.funding?.venues?.[0] || null;

      const plan = nar.plan || {};
      const checklist = nar.checklist || [];
      const passes = checklist.filter(c => c.pass === true).length;
      const fails = checklist.filter(c => c.pass === false).length;
      const stale = checklist.find(c => c.key === 'freshness' && c.pass === false) ? true : false;

      // ---- gates ----
      const bestR = plan.bestR ?? null;
      const gates = [];
      let tradable = true;

      if (lsrAbs !== null && lsrAbs >= 2.5) {
        gates.push(`LSR ${lsrAbs.toFixed(2)} ≥ 2.5 — MAGNET GATE: passive entries BANNED (S3/S2); S1 sweep-reversal only`);
      } else if (lsrAbs !== null && lsrAbs >= 2.0) {
        gates.push(`LSR ${lsrAbs.toFixed(2)} 2.0–2.5 — S3 half-size at Grade B max`);
      } else if (lsrAbs !== null) {
        gates.push(`LSR ${lsrAbs.toFixed(2)} < 2.0 — S3 fully eligible`);
      } else {
        gates.push('LSR n/a (no liq cluster totals)');
      }

      if (bestR !== null && bestR < 2.0 && bestR >= 1.5) gates.push(`R ${bestR.toFixed(2)} in 1.5–2.0 — below desk 2.0R standard (OK only for 40/40/20 composite)`);
      if (bestR !== null && bestR < 1.5) { gates.push(`R ${bestR.toFixed(2)} < 1.5 floor — NOT tradable`); tradable = false; }
      if (bestR === null) gates.push('no measurable R (WAIT state / chase guard / no target geometry)');
      if (stale) gates.push('stale telemetry (signals/cvd/walls/liq) — refresh before execution');
      if (nar.direction === 'WAIT' || !nar.direction) { gates.push('engine in WAIT state'); tradable = false; }
      if (openSyms.includes(sym)) { gates.push('POSITION ALREADY OPEN — manage, do not re-enter'); tradable = false; }
      if ((plan.vetoes || []).length) gates.push(...plan.vetoes.map(v => `veto: ${v}`));

      // confluence score: confidence (0-100) + checklist passes + R bonus + trend/model agreement
      let score = (nar.confidence || 0) * 0.5 + passes * 8;
      if (bestR !== null) score += Math.min(bestR, 4) * 10;
      if (h4Trend !== 'FLAT' && nar.regime?.includes(h4Trend === 'UP' ? 'UP' : 'DOWN')) score += 5;
      if (stale) score -= 15;

      results.push({
        asset: sym, mt5Sym, supported: true,
        price, chgDay, regime: nar.regime, regimeNote: nar.regimeNote,
        direction: nar.direction, grade: nar.grade, confidence: nar.confidence,
        activeModel: nar.activeModel, m1: nar.m1?.status, m2: nar.m2?.status,
        h4Trend, passes, fails, stale,
        lsr: lsrAbs === null ? null : Number(lsrAbs.toFixed(2)),
        magnetDominant, shortsAbove, longsBelow,
        funding8hPct: fund ? (fund.rate8h * 100) : null,
        plan: {
          entryZone: plan.entryZone || null,
          compositeEntry: plan.compositeEntry || null,
          triggerRule: plan.triggerRule || null,
          stop: plan.stop ?? null,
          invalidation: plan.invalidation || null,
          targets: plan.targets || [],
          bestR, vetoes: plan.vetoes || [],
        },
        checklist, gates, tradable, score: Number(score.toFixed(1)),
      });
    } catch (e) {
      results.push({ asset: sym, mt5Sym, supported: false, note: e.message });
    }
  }

  // 3-wide parallelism to be gentle on the local API
  async function worker() { while (queue.length) { const s = queue.shift(); await scanOne(s); } }
  await Promise.all([worker(), worker(), worker()]);

  results.sort((a, b) => (b.score || 0) - (a.score || 0));
  fs.writeFileSync('scripts/mt5_confluence_scan.json', JSON.stringify(results, null, 2));

  const ok = results.filter(r => r.supported);
  const ranked = ok.filter(r => r.tradable);
  console.log(`================================================================================`);
  console.log(` MT5 CONFLUENCE SCAN — ${new Date().toISOString()}`);
  console.log(`================================================================================`);
  for (const r of ranked) {
    const p = r.plan;
    console.log(`\n[${r.asset} / ${r.mt5Sym}] ${r.direction} · ${r.regime} · Grade ${r.grade} · conf ${r.confidence}% · score ${r.score}`);
    console.log(`  px ${fmt(r.price)} · day ${r.chgDay === null ? '—' : r.chgDay.toFixed(2)}% · H4 ${r.h4Trend} · model ${r.activeModel} · M1:${r.m1} M2:${r.m2}`);
    console.log(`  LSR ${r.lsr ?? '—'} (${r.magnetDominant || '—'}) · shorts↑$${(r.shortsAbove / 1e6).toFixed(1)}M longs↓$${(r.longsBelow / 1e6).toFixed(1)}M · funding8h ${r.funding8hPct === null ? '—' : r.funding8hPct.toFixed(3) + '%'}`);
    console.log(`  checklist ${r.passes}✓/${r.fails}✗${r.stale ? ' · STALE' : ''}`);
    if (p.entryZone) console.log(`  ENTRY ${fmt(p.entryZone[0])}–${fmt(p.entryZone[1])}${p.compositeEntry ? ' (composite ' + fmt(p.compositeEntry) + ')' : ''}`);
    if (p.stop !== null) console.log(`  STOP ${fmt(p.stop)} · invalidation: ${p.invalidation}`);
    for (const t of p.targets) console.log(`  TGT ${fmt(t.level)} · ${t.label} · R ${t.rMultiple === null ? '—' : t.rMultiple.toFixed(2)}`);
    console.log(`  bestR ${p.bestR === null ? '—' : p.bestR.toFixed(2)}`);
    for (const g of r.gates) console.log(`  gate> ${g}`);
  }
  console.log(`\n--------------------------------------------------------------------------------`);
  console.log(`NON-TRADABLE / WAIT (for the watchlist):`);
  for (const r of ok.filter(r => !r.tradable)) {
    console.log(`  [${r.asset.padEnd(5)}] ${r.direction} conf ${r.confidence}% — ${(r.gates.find(g => g.includes('veto') || g.includes('R ') || g.includes('WAIT') || g.includes('POSITION') || g.includes('no measurable')) || r.activeModel)}`);
  }
  const unsup = results.filter(r => !r.supported);
  if (unsup.length) console.log(`UNSUPPORTED: ${unsup.map(r => r.asset).join(', ')}`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
