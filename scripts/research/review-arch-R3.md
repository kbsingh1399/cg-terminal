# RV-ARCH — Architect review: classic derivatives routes (round 3)

**Date:** 2026-11-11 · **Reviewer:** RV-ARCH (system architect)
**Scope:** `src/lib/cg/perpmap.ts`, `src/app/api/cg/perpdepth|cot|cnbc/route.ts`, `src/components/cg/derivatives-panel.tsx`, `src/components/cg/classic-overview.tsx` (integration point), `scripts/desk_deepscan.py` §2–§6 classic section.
**Method:** full read of every file above + cross-checks against `client.ts`, `types.ts`, `classic.ts`, `assets.ts`, `use-cg-data.ts`, `page.tsx`, `orderflow/funding/classic` routes. `npx tsc --noEmit` → clean (exit 0). No runtime claims below that I did not trace in code.

---

## Verdict

The layer is convention-compliant in structure (registry-gated 400s, globalThis TTL caches with caps, UA + timeout + 502 on external fetches, no `any`, no fabricated arrays) and the **`settled[]` index arithmetic, OI delta windows, vol24h window, netFlow column indices and funding conversion are all correct** (verification below). But it ships **3 blockers**: a COT z-score computed on the wrong end of the series, a guaranteed 500 on US2000, and a registry-key mismatch that silently kills the whole feature for the S&P 500 — the instrument that motivated it.

---

## BLOCKER

### B1. COT 3y z-score is computed on the OLDEST record, not the latest
`src/app/api/cg/cot/route.ts:48` — `return +(((vals[vals.length - 1] - mean) / sd).toFixed(2));`

The Socrata query orders DESC (`route.ts:69-70`, `$order=report_date_as_yyyy_mm_dd DESC`), so `netSeries[0]` is the **newest** week — the route itself relies on that at `route.ts:112-113` (`netNow = netSeries[0].net`, `netPrev = netSeries[1].net`). But `zscore()` at `:48` takes `vals[vals.length - 1]` = the **oldest** record in the 170-week window. Every consumer gets the z-score of a ~3.2-year-old net position labelled "3y z-score":

- panel `derivatives-panel.tsx:207-209` — highlights "positioning extreme" off it;
- deepscan `desk_deepscan.py:1389` — prints `3y z **…σ**` in the desk report.

Wrong number presented as a contrarian-extreme signal on an "institutional-grade" terminal = worst class of bug (silent, credible-looking).

**Fix:** `return +(((vals[0] - mean) / sd).toFixed(2));` — or pass `netSeries.map(...).reverse()` and keep the function as-is. Add a one-line unit test pinning ordering (newest at 0).

### B2. `/api/cg/perpdepth?sym=US2000` crashes with a 500 (unhandled TypeError)
`src/app/api/cg/perpdepth/route.ts:87` — `const lead = entry.venues.find((v) => v.lead) ?? entry.venues[0];` → `undefined` for `US2000` (`perpmap.ts:63-67`, `venues: []`, deliberately "COT only"), then `route.ts:90` dereferences `lead.key` → TypeError → unhandled → 500.

Reachable and hot: `US2000` is a classic instrument (`classic.ts:50`), selectable in the palette and on the arrow-rotate path (`page.tsx:33,78`), and `ClassicOverview` (`classic-overview.tsx:367`) renders `DerivativesPanel`, which polls `/api/cg/perpdepth?sym=US2000` every 60 s (`derivatives-panel.tsx:105`). Same for the deepscan (`desk_deepscan.py:1350`). Violates the honest-400 contract and sprays stack traces.

**Fix:** gate on venue existence, not just registry presence:
```ts
if (!entry || !entry.venues.length) return NextResponse.json({ ok: false, error: `no verified perp coverage for ${sym} — …` }, { status: 400 });
```

### B3. Registry key mismatch `SP500` vs `SPX500` — derivatives panels silently dead for the S&P 500
`perpmap.ts:45` keys the entry `SP500`; the classic registry (`classic.ts:48`) and therefore the UI, the deepscan CLASSIC dict (`desk_deepscan.py:103` builds it from the route's registry) all use **`SPX500`**. `perpMapOf("SPX500")` → `undefined` → all three routes 400 → `hasAny` false → the panel hides itself (`derivatives-panel.tsx:112-113`). The instrument whose discovery motivated this feature (perpmap header: "tradeXYZ SP500-USD $463M vol") shows nothing, in both the terminal and the desk report, with no error anywhere. The 400 body even advertises the `SP500` key the caller can never produce.

**Fix:** alias in the map — `SPX500: PERP_MAP.SP500` (or rename the key to `SPX500` and update the 400 hint lists at `perpdepth/route.ts:80`, `cot/route.ts:57`, `cnbc/route.ts:58`). Add a compile-time assertion that every `CLASSIC_ASSETS` sym with derivatives coverage resolves via `perpMapOf`.

---

## MAJOR

### M1. COT errors are negative-cached for the full 6 h TTL
`src/app/api/cg/cot/route.ts:18,61-65,90,96,100` — failure entries (`err`) are stored with the same `TTL_MS = 6h` as successes, and the hit path (`:62-65`) replays the 502 while fresh. One transient CFTC hiccup (12 s timeout, network blip) blanks the COT card for 6 hours; the panel polls at 6 h (`derivatives-panel.tsx:106`), so recovery is ≥6 h. Compare `cnbc/route.ts` where the error TTL is implicitly 60 s — fine there.

**Fix:** `const ttl = hit.err ? 10 * 60_000 : TTL_MS;` (short negative-cache so transient failures self-heal).

### M2. deepscan: `z` shadowing corrupts the §8 scorecard for every COT-mapped classic symbol
`scripts/desk_deepscan.py:1385` — `z = cot.get("z3y")` overwrites the session z-score from `:1317` (`z = (price - anchor) / sd`). The `session-dev` vote at `:1411` (`-1 if z > 1 else (1 if z < -1 else 0)`, label `f"z {z:+.2f}σ"`) then votes on **COT positioning** instead of price-vs-anchor for the 9 COT-mapped classic syms — a wrong "lean" input printed as `**lean: …**`. Also latent crash: if `z3y` is ever `None`, `None > 1` raises TypeError, and the callers (`:1680`, `:1692`) have no try/except → the whole classic scan aborts mid-run.

**Fix:** rename to `z_cot = cot.get("z3y")` and use it only in the COT block (`:1389`). Optionally wrap `classic_report` calls like `deep_report`'s loop.

### M3. perpdepth returns `ok: true` with an all-null body when Coinglass is fully down
`src/app/api/cg/perpdepth/route.ts:89-114` — every job `.catch(() => null)`; if all Coinglass calls fail the route still returns `ok: true` with null price/OI/flow (`:150-165`) and caches it as a success for 60 s. The panel then renders the depth card with a **"REAL LIQUIDITY" badge** and "–" everywhere (`derivatives-panel.tsx:127-129`). Violates the graceful-502 convention (e) and reads as data-verified when it is data-dead.

**Fix:** `if (!leadBars.length && !oiBars.length) return NextResponse.json({ ok: false, error: "coinglass unreachable" }, { status: 502 });` (before `cache.set`).

### M4. netFlow USD fallback can report base-volume units under a USD label
`src/app/api/cg/perpdepth/route.ts:63-64` — `Number(r[4] ?? r[2] ?? 0)` / `Number(r[5] ?? r[3] ?? 0)`: if the USD columns are absent, it silently falls back to `buyBaseVol/sellBaseVol` (per `types.ts:9` `OrderFlowBucket = [priceLow, priceHigh, buyBaseVol, sellBaseVol, buyUsd, sellUsd, …]`) and emits it as `takerFlow15mUsd` (`:161`) — a units lie on a flow figure. The indices themselves are **correct**; the fallback is the problem.

**Fix:** drop the `?? r[2] / ?? r[3]` fallback (use 0 only for malformed values, `null` the whole metric if no bucket carries USD columns), or add a `unit` field and label it in the panel.

### M5. Funding filter suppresses genuine 0.00 % rates
`src/app/api/cg/perpdepth/route.ts:145` — `.filter((x) => typeof x.rate === "number" && x.rate !== 0)` deletes real zero rates. `perpmap.ts:77` itself documents "OKX funding 0.0%/8h at probe" as live-verified data for JP225 — that venue can never appear in the panel. A 0 % funding is meaningful information (free carry), not noise.

**Fix:** keep only the `typeof x.rate === "number"` guard; let 0.0000 % render.

---

## MINOR

### m1. perpdepth: lead-venue failure omits the row entirely; non-lead failures get `stale: true`
`route.ts:121-123` pushes the lead row only `if (leadBars.length)`; `:127-129` pushes `{stale: true}` for empty non-lead venues. Asymmetric degradation — the most important venue silently vanishes instead of showing "stale".
**Fix:** push `{ id: lead.id, key: lead.key, close: null, vol24h: null, lead: true, stale: true }` in the else branch.

### m2. COT `history` comment inverts the actual order; panel compensates with a second inversion
`cot/route.ts:139` — `history: netSeries.slice(0, 78), // ~18 months, oldest→newest for charts` — the series is **newest→oldest** (DESC). `derivatives-panel.tsx:115` does `.reverse()`, so the sparkline renders correctly only because two errors cancel. Any future consumer trusting the comment renders a time-inverted series.
**Fix:** emit ascending in the route (`.slice(0, 78).reverse()`), fix the comment, delete the panel's `.reverse()`.

### m3. deepscan conflates honest-400 with route-unreachable, and discards the 400 body it claims to surface
`desk_deepscan.py:78-80` — `get()` uses `urllib.request.urlopen`, which raises `HTTPError` on 400/502; `:1349-1360` catches everything into `None`, so `:1382-1383` prints "(route unreachable)" for *both* a clean 400 (no mapping) and a 500. The comment at `:1346-1347` ("self-documenting: the 400 body lists the covered registry") describes behavior the code does not implement.
**Fix:** catch `urllib.error.HTTPError`, parse `e.read()`, keep the body's `error` string, and print it instead of "route unreachable".

### m4. COT `?? 0` coercion can fabricate a net-0 record
`cot/route.ts:108` — `(r.noncomm_positions_long_all ?? 0) - (r.noncomm_positions_short_all ?? 0)` turns a record with missing fields into `net: 0`, which can become `netNow` (`:112`) and render as "large-spec net 0". **Fix:** filter records where both fields are non-numbers (`netSeries` should skip them, as it already skips empty dates).

### m5. CNBC: only `null`/`undefined` guarded on `FormattedQuote`
`cnbc/route.ts:80,87` — `j.FormattedQuoteResult?.FormattedQuote ?? []` then `new Map(quotes.map(…))` **outside** the try/catch. If upstream ever returns a non-array truthy value, `.map` throws → unhandled 500. **Fix:** `quotes = Array.isArray(quotes) ? quotes : [];` Also consider stripping `%` in `num()` (`:41-45`) alongside commas.

### m6. XAU/XAG/XPT perpmap entries are unreachable from any UI path
`perpmap.ts:145-168` — XAU/XAG/XPT are perp-registry assets (`assets.ts:73-78`) rendered by `OverviewTool`, not `ClassicOverview`; `DerivativesPanel` only mounts inside the classic view (`classic-overview.tsx:367`). The tradeXYZ venues / COT / CNBC mappings for metals are dead config except for manual API calls, despite the map comment "this map serves the classic view". Not wrong data — uncaptured value. **Fix:** mount `DerivativesPanel` in the perp overview too, or note the API-only status in the map.

---

## NIT

- **n1.** `derivatives-panel.tsx:12,14` — docblock says `/api/cot`, `/api/cnbc`; the code correctly calls `/api/cg/cot|cnbc` (`:106-107`). Fix the comment (convention a).
- **n2.** `cot/route.ts:70` — "3y z-score" over 170 weekly records ≈ 3.27 y. Use `156` for a true 3y or relabel "3.3y".
- **n3.** `perpdepth/route.ts:156` — `priceSeries` is returned but no consumer uses it; funding extraction (`:138-148`) duplicates `/api/cg/funding` logic (shareable helper).
- **n4.** `perpdepth/route.ts:135` — flow bar chosen by array index (`flowBars[length-1]`); harden by picking max `ts` (codebase-wide klines are ascending, so this is convention-consistent, just fragile).
- **n5.** `perpmap.ts:176-178` — `CLASSIC_PERP_SYMS` is exported and referenced nowhere (grep across src/scripts). Wire it into the 400 hint or delete.
- **n6.** `desk_deepscan.py:1376` — Δ-OI line is gated on `d4h is not None`; if only `d24h` is null the whole line prints "n/a". Gate per-field.
- **n7.** `perpdepth/route.ts:146` — `x.rate != null ? … : null` inside the map is dead code after the `typeof === "number"` filter at `:145`.

---

## Explicitly verified CORRECT (requested checks)

1. **`settled[]` index arithmetic** (`perpdepth/route.ts:88-141`): jobs are `[leadKline, leadOi, ...venueKlines(len), flow, funding]`. `venueKlines` is `entry.venues.map(...)` **preserving venue order**, with the lead's slot as `Promise.resolve(null)` (`:100-104`); consumption `settled[2 + i]` against `entry.venues[i]` with the lead skipped by key equality (`:124-126`) is therefore aligned. `flow = settled[2 + len]` (`:134`) and `funding = settled[3 + len]` (`:139`) match the push order (`:110`, `:114`). **Correct** — including the case where the lead is not `venues[0]` and single-venue entries (XAU et al., no `lead` flag → `venues[0]`).
2. **OI delta windows** (`:35-47`): `at(back)` = `oi[len-1-back]` with 15 m bars → `at(4)`=1 h, `at(16)`=4 h, `at(96)`=24 h; `limit=97` supplies exactly index 0 for `back=96` (`oi.length > back` guard → null when short). **No off-by-one.**
3. **vol24h** (`:122,131,155`): `slice(-96)` = 96×15 m = 24 h; `row[5]` = volumeUsd per `types.ts:4`. **Correct.**
4. **netFlow USD indices** (`:59-68`): `r[4]`/`r[5]` = buyUsd/sellUsd per `types.ts:9` `OrderFlowBucket`. **Correct** (fallback issue is M4, not the indices).
5. **Funding conversion** (`:146`): decimal fraction `× 100` → `%` with 4-dp rounding; panel renders `%/{intervalH}h`. **Correct.**
6. **CNBC pipe-batching** (`cnbc/route.ts:69-71,87-90`): `join("|")` then `encodeURIComponent`, response matched by uppercased `q.symbol` both sides, 12-sym cap, dedupe, per-sym `ok:false` for empty quotes rather than fabrication. **Consistent with the probed contract; no crash path found for null/short payloads** (non-array `FormattedQuote` is m5).
7. **Convention compliance:** all three routes: `dynamic = "force-dynamic"`, registry-gated honest 400 with the covered-symbol list, globalThis Map cache with TTL + insertion-order size cap (32/32/48 — mirrors `classic/route.ts`), UA + `AbortSignal.timeout(12_000)` + `cache: "no-store"` on external fetches, 502 error JSON on upstream failure (perpdepth exception = M3), `perpmap.ts` mirrors the `assets.ts`/`classic.ts` registry pattern, trap exclusions documented. **`tsc --noEmit` clean; no `any` in the new code** (`unknown[]` boundary rows + localized casts only).
8. **usePolling integration** (`use-cg-data.ts:26-49`): generation counter + URL-change reset means a stale SPX500→USO switch can never render cross-symbol data; the panel's `data.sym === sym` guards are defense-in-depth on top.

---

## Suggested fix order

1. B1 (one character: `vals[0]`) + m2 (same file, ordering normalize)
2. B3 (alias `SPX500`) + B2 (venue-length gate) — both one-liners in `perpmap.ts` / `perpdepth` route
3. M2 (rename `z` → `z_cot` in deepscan)
4. M1 / M3 / M4 / M5 (resilience + units honesty)
5. MINORs and NITs opportunistically; add a small ordering/unit test for `zscore` and `oiDeltas` while touching them.
