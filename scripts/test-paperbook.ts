/**
 * Virtual Book — deterministic state-machine test (2026-11-12).
 *
 * Run: bun scripts/test-paperbook.ts
 *
 * Drives the REAL module (src/lib/cg/paperbook.ts) with synthetic verdicts
 * and synthetic m1 bars (test input only — the product never fabricates
 * data) and asserts the exact accounting:
 *
 *   T1  fill at zone near-edge on first touch (wick counts, not close)
 *   T2  rung-1 books 50% + stop→BE; same-bar BE re-check is pessimistic
 *   T3  full TP2 ladder: 50% @ T1 + 50% @ T2
 *   T4  SL before any rung = full −1R
 *   T5  SHORT mirror of the fill/stop path
 *   T6  drift < 0.6% refreshes the SAME ticket (no supersede churn)
 *   T7  opposite-direction arm cancels the armed ticket (model flip)
 *   T8  M2 market-entry arming gates on market-data freshness
 *   T9  same-bar stop+rung conflict resolves pessimistically (stop first)
 *
 * All file writes are sandboxed to a temp CG_DATA_DIR.
 */
process.env.CG_DATA_DIR = `/tmp/pb-test-${Date.now()}`;
process.env.CG_PAPERBOOK_ASSETS = "BTC"; // sweep restricted (never started here anyway)

const mod = await import("../src/lib/cg/paperbook");
const { armFromVerdict, processBar, resetPaperBook, getRawTicket } = mod as {
  armFromVerdict: (v: unknown, source: "route" | "sweep") => { action: string; reason: string; id: string | null };
  processBar: (t: unknown, bar: { t: number; o: number; h: number; l: number; c: number }) => void;
  resetPaperBook: () => void;
  getRawTicket: (id: string | null) => any;
};

/** the LIVE stored ticket (mutations land on the real book object) */
const T = (id: string | null) => getRawTicket(id);

interface Bar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

let barClock = Date.now() - 60 * 60_000;
const bar = (o: number, h: number, l: number, c: number): Bar => {
  barClock += 60_000;
  return { t: barClock, o, h, l, c };
};

function verdict(over: Record<string, unknown>): Record<string, unknown> {
  return {
    ok: true,
    supported: true,
    sym: "BTC",
    name: "Bitcoin",
    kind: "crypto",
    regime: "TREND_UP",
    regimeNote: "test",
    activeModel: "M1_TREND_PULLBACK",
    direction: "LONG",
    grade: "A",
    confidence: 80,
    thesis: "test",
    plan: {
      entryZone: [100, 101],
      triggerRule: "test",
      stop: 98,
      invalidation: "test",
      targets: [
        { level: 104, label: "T1", rMultiple: 1.0 },
        { level: 108, label: "T2", rMultiple: 2.33 },
        { level: 112, label: "T3", rMultiple: 3.67 },
      ],
      bestR: 2.33,
      vetoes: [],
    },
    checklist: [],
    m1: null,
    m2: null,
    freshness: { worstAgeMs: 1000, staleFields: [], dataAt: Date.now(), ageMs: 5000, stale: false, source: "test" },
    beta: [],
    generatedAt: Date.now(),
    ...over,
  };
}

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}
const r2 = (x: number) => Number(x.toFixed(2));
const realized = (t: any) => r2(t.legs.reduce((s: number, l: any) => s + l.frac * l.r, 0));

resetPaperBook();

// ---------------------------------------------------------------------------
// T1 — fill at zone near-edge on first touch (LONG: near edge = zoneHi = 101)
// ---------------------------------------------------------------------------
{
  const res = armFromVerdict(verdict({}), "route");
  check("T1a arm M1 LONG", res.action === "armed", `${res.action}: ${res.reason}`);
  let t = T(res.id);
  check("T1b born ARMED", t.status === "ARMED");
  processBar(t, bar(103, 103.5, 100.5, 101)); // dips into the zone (low 100.5 <= 101)
  t = T(res.id);
  check("T1c filled at near edge 101", t.status === "OPEN" && t.filledPrice === 101, `filledPrice=${t.filledPrice} source=${t.fillSource}`);
  check("T1d no rung hit yet", t.targets[0].hitAt == null && t.legs.length === 0);
  check("T1e MAE recorded from the wick", r2(t.maeR) === r2((100.5 - 101) / 3), `maeR=${r2(t.maeR)}`);
}

resetPaperBook();

// ---------------------------------------------------------------------------
// T2 — rung-1 books 50% + BE; same-bar BE re-check pessimistic
// ---------------------------------------------------------------------------
{
  const res = armFromVerdict(verdict({}), "route");
  let t = T(res.id);
  processBar(t, bar(103, 103.5, 100.5, 101)); // fill @ 101
  processBar(t, bar(101.5, 104.8, 101, 104)); // T1 hit; wick tags BE same bar
  t = T(res.id);
  check("T2a rung-1 hit at 104", t.targets[0].hitAt != null && t.targets[0].hitPrice === 104);
  check("T2b booked 50% @ +1.00R", t.legs.length >= 1 && r2(t.legs[0].r) === 1.0 && t.legs[0].frac === 0.5, `legs=${JSON.stringify(t.legs.map((l: any) => [l.frac, r2(l.r)]))}`);
  check("T2c stop moved to BE", t.stopAtBe === true && t.stop === 101);
  check("T2d same-bar BE closed the rest at 0R", t.status === "CLOSED" && t.outcome === "BE", `status=${t.status} outcome=${t.outcome}`);
  check("T2e realized = +0.50R (fraction-weighted)", realized(t) === 0.5, `realized=${realized(t)}`);
  check("T2f MFE from the rung-1 wick", r2(t.mfeR) === r2((104.8 - 101) / 3), `mfeR=${r2(t.mfeR)}`);
}

resetPaperBook();

// ---------------------------------------------------------------------------
// T3 — full ladder: 50% @ T1, then remaining 50% @ T2 → CLOSED TP2
// ---------------------------------------------------------------------------
{
  const res = armFromVerdict(verdict({}), "route");
  let t = T(res.id);
  processBar(t, bar(103, 103.5, 100.5, 101)); // fill @ 101
  processBar(t, bar(102, 105, 101.5, 104.5)); // T1 @ 104 (no BE touch: low 101.5 > 101)
  t = T(res.id);
  check("T3a open after rung-1 (no BE touch)", t.status === "OPEN", `status=${t.status}`);
  processBar(t, bar(105, 109, 104, 108.5)); // T2 @ 108
  t = T(res.id);
  check("T3b closed TP2", t.status === "CLOSED" && t.outcome === "TP2", `outcome=${t.outcome}`);
  const expect = 0.5 * ((104 - 101) / 3) + 0.5 * ((108 - 101) / 3);
  check("T3c realized = 0.5·1R + 0.5·2.33R", Math.abs(realized(t) - r2(expect)) < 0.01, `realized=${realized(t)} expect=${r2(expect)}`);
}

resetPaperBook();

// ---------------------------------------------------------------------------
// T4 — SL before any rung = full −1R
// ---------------------------------------------------------------------------
{
  const res = armFromVerdict(verdict({}), "route");
  let t = T(res.id);
  processBar(t, bar(103, 103.5, 100.5, 101)); // fill @ 101
  processBar(t, bar(100.5, 101, 97.8, 98.5)); // stop 98 hit on the wick
  t = T(res.id);
  check("T4a closed SL", t.status === "CLOSED" && t.outcome === "SL", `outcome=${t.outcome}`);
  check("T4b realized = −1.00R", realized(t) === -1.0, `realized=${realized(t)}`);
}

resetPaperBook();

// ---------------------------------------------------------------------------
// T5 — SHORT mirror: fill at zoneLo, stop above
// ---------------------------------------------------------------------------
{
  let t = T(
    armFromVerdict(
      verdict({
        regime: "TREND_DOWN",
        direction: "SHORT",
        plan: {
          entryZone: [99, 100],
          triggerRule: "test",
          stop: 102,
          invalidation: "test",
          targets: [
            { level: 96, label: "T1", rMultiple: 1.0 },
            { level: 93, label: "T2", rMultiple: 2.0 },
          ],
          bestR: 2.0,
          vetoes: [],
        },
      }),
      "route"
    ).id
  );
  processBar(t, bar(98.5, 99.8, 97, 98)); // rallies into the zone (high 99.8 >= 99)
  t = T(t.id);
  check("T5a SHORT filled at near edge 99", t.status === "OPEN" && t.filledPrice === 99, `filledPrice=${t.filledPrice}`);
  processBar(t, bar(98, 102.5, 97.5, 102)); // stop 102 hit
  t = T(t.id);
  check("T5b closed SL (gap-open worse = fill at stop)", t.outcome === "SL" && t.legs[t.legs.length - 1].price === 102, `exit=${t.legs[t.legs.length - 1]?.price}`);
  check("T5c realized = −1.00R", realized(t) === -1.0, `realized=${realized(t)}`);
}

resetPaperBook();

// ---------------------------------------------------------------------------
// T6 — drift < 0.6% refreshes the SAME ticket (idempotent book)
// ---------------------------------------------------------------------------
{
  const first = armFromVerdict(verdict({}), "route");
  const second = armFromVerdict(
    verdict({
      plan: {
        entryZone: [100.2, 101.2], // ~0.2% drift
        triggerRule: "test",
        stop: 98.05,
        invalidation: "test",
        targets: [
          { level: 104, label: "T1", rMultiple: 1.0 },
          { level: 108, label: "T2", rMultiple: 2.33 },
        ],
        bestR: 2.33,
        vetoes: [],
      },
    }),
    "sweep"
  );
  check("T6a drifted setup refreshes", second.action === "refreshed", `${second.action}: ${second.reason}`);
  check("T6b same ticket id", first.id === second.id, `${first.id} vs ${second.id}`);
  const t = T(first.id);
  check("T6c frozen levels kept", t.entryZone[0] === 100 && t.stop === 98, `zone=${t.entryZone} stop=${t.stop}`);
}

resetPaperBook();

// ---------------------------------------------------------------------------
// T7 — opposite-direction armable setup cancels the armed ticket
// ---------------------------------------------------------------------------
{
  const long = armFromVerdict(verdict({}), "route");
  const flip = armFromVerdict(
    verdict({
      regime: "TREND_DOWN",
      direction: "SHORT",
      plan: {
        entryZone: [95, 96],
        triggerRule: "test",
        stop: 99,
        invalidation: "test",
        targets: [{ level: 90, label: "T1", rMultiple: 1.67 }],
        bestR: 1.67,
        vetoes: [],
      },
    }),
    "route"
  );
  check("T7a flip arms the short", flip.action === "armed", `${flip.action}: ${flip.reason}`);
  const longT = T(long.id);
  const shortT = T(flip.id);
  check("T7b old long cancelled (model flip)", longT.status === "CLOSED" && longT.outcome === "CANCELLED" && /flip/i.test(longT.cancelReason ?? ""), `${longT.outcome}: ${longT.cancelReason}`);
  check("T7c new short armed", shortT.status === "ARMED");
}

resetPaperBook();

// ---------------------------------------------------------------------------
// T8 — M2 market-entry gates on market freshness (no stale-sweep look-ahead)
// ---------------------------------------------------------------------------
{
  const stale = armFromVerdict(
    verdict({
      activeModel: "M2_MEAN_REVERSION",
      freshness: { worstAgeMs: 40 * 60_000, staleFields: ["market"], dataAt: Date.now() - 40 * 60_000, ageMs: 40 * 60_000, stale: true, source: "test" },
    }),
    "sweep"
  );
  check("T8a stale M2 skipped", stale.action === "skipped" && /10 min/.test(stale.reason), `${stale.action}: ${stale.reason}`);
  const fresh = armFromVerdict(
    verdict({
      activeModel: "M2_MEAN_REVERSION",
      plan: {
        entryZone: [100, 100.45],
        triggerRule: "test",
        stop: 98.6,
        invalidation: "test",
        targets: [
          { level: 102.2, label: "T1", rMultiple: 1.2 },
          { level: 100.5, label: "T2", rMultiple: 1.5 },
        ],
        bestR: 1.5,
        vetoes: [],
      },
    }),
    "route"
  );
  check("T8b fresh M2 armed (fills at live mark on the next track pass)", fresh.action === "armed", `${fresh.action}: ${fresh.reason}`);
}

resetPaperBook();

// ---------------------------------------------------------------------------
// T9 — same-bar stop + rung conflict resolves pessimistically (stop first)
// ---------------------------------------------------------------------------
{
  const res = armFromVerdict(verdict({}), "route");
  let t = T(res.id);
  processBar(t, bar(103, 103.5, 100.5, 101)); // fill @ 101
  // one violent bar sweeping BOTH the stop (98) and T1 (104)
  processBar(t, bar(101, 106, 97.5, 105));
  t = T(res.id);
  check("T9a stop won the same-bar conflict", t.status === "CLOSED" && t.outcome === "SL", `outcome=${t.outcome}`);
  check("T9b realized = −1.00R (no rung booked)", realized(t) === -1.0 && t.legs.length === 1, `realized=${realized(t)} legs=${t.legs.length}`);
}

console.log(`\n===== ${pass}/${pass + fail} passed =====`);
process.exit(fail ? 1 : 0);
