import { NextRequest } from "next/server";
import { buildNarrative } from "@/lib/cg/narrative";
import { anyTerminalSym } from "@/lib/cg/sym-gate";

export const dynamic = "force-dynamic";
export const maxDuration = 130;

/**
 * POST /api/cg/narrative/ai — OPTIONAL streaming AI desk brief (WS5).
 *
 * STRICTLY on-demand (button click only — never polled, never on page load):
 * streams an SSE brief grounded in the VERIFIED NarrativeVerdict + quant +
 * options telemetry for the symbol, with the model explicitly instructed to
 * cite only the supplied numbers and to surface risks/blindspots.
 *
 * Configuration: NVIDIA_API_KEY in .env (OpenAI-compatible endpoint
 * integrate.api.nvidia.com/v1, model z-ai/glm-5.3-flash). When the key is
 * absent the route answers ok:false with the honest reason and the UI hides
 * the button — the key NEVER leaves the server.
 *
 * Caching: 15 minutes per (sym, barTs) — the m15 bar the verdict was built
 * on. 120 s hard timeout on the upstream stream.
 */

const AI_BASE = "https://integrate.api.nvidia.com/v1";
const AI_MODEL = "z-ai/glm-5.3-flash";
const CACHE_TTL = 15 * 60_000;
const UPSTREAM_TIMEOUT_MS = 120_000;

const gAi = globalThis as unknown as { __cgAiBriefCache?: Map<string, { at: number; text: string; sym: string }> };
const cache = (gAi.__cgAiBriefCache ??= new Map());

export async function POST(req: NextRequest) {
  const key = process.env.NVIDIA_API_KEY;
  let sym = "BTC";
  try {
    const body = (await req.json().catch(() => ({}))) as { sym?: string };
    sym = (body.sym ?? "BTC").trim().toUpperCase();
  } catch {
    /* default sym */
  }
  if (!(await anyTerminalSym(sym))) {
    return Response.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  if (!key) {
    // honest state, not an HTTP error — the UI disables the button
    return Response.json({
      ok: false,
      reason: "NVIDIA_API_KEY not configured — the AI desk brief is optional; add the key to .env to enable it",
    });
  }

  // ground truth: the verified verdict + quant + options payloads
  const verdict = await buildNarrative(sym);
  if (!verdict || verdict.ok !== true) {
    return Response.json({ ok: false, reason: `no verified narrative for ${sym} — the AI brief refuses to write ungrounded` });
  }
  const barTs = Math.floor((verdict.freshness?.dataAt ?? Date.now()) / 900_000);
  const cacheKey = `${sym}|${barTs}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL) {
    return new Response(`data: ${JSON.stringify({ type: "cached", text: hit.text, cached: true })}\n\ndata: [DONE]\n\n`, {
      headers: { "content-type": "text/event-stream", "cache-control": "no-store", "x-cg-ai-cached": "1" },
    });
  }

  // quant + options lite (in-process route pattern — module caches make this cheap)
  const quant = await (async () => {
    try {
      const { GET } = await import("../../quant/route");
      const r = await GET(new Request(`http://local/api/cg/quant?sym=${encodeURIComponent(sym)}`) as never);
      const j = (await r.json()) as Record<string, unknown>;
      return {
        fundingAprPct: (j.funding as { annualizedAprPct?: number | null } | undefined)?.annualizedAprPct ?? null,
        oiQuadrant4h: (j.oiQuadrant as Record<string, { quadrant?: string }> | undefined)?.["4h"]?.quadrant ?? null,
        topLs: (j.lsRatios as Record<string, { topPositions?: { ratio?: number } }> | undefined)?.["1h"]?.topPositions?.ratio ?? null,
        coinbasePremiumBps: (j.basis as { coinbasePremiumBps?: number | null } | undefined)?.coinbasePremiumBps ?? null,
      };
    } catch {
      return null;
    }
  })();
  const options = await (async () => {
    try {
      const { GET } = await import("../../options/route");
      const r = await GET(new Request(`http://local/api/cg/options?sym=${encodeURIComponent(sym)}`) as never);
      const j = (await r.json()) as Record<string, unknown>;
      return {
        gexRegime: (j.gex as { regime?: string } | undefined)?.regime ?? null,
        rr25d: (j.riskReversal25d as { value?: number } | undefined)?.value ?? null,
        dvol: (j.dvol as { value?: number } | undefined)?.value ?? null,
      };
    } catch {
      return null;
    }
  })();

  const planLines = verdict.plan.targets
    .map((t) => `- ${t.label}: ${t.level ?? "n/a"}${t.rMultiple != null ? ` (${t.rMultiple.toFixed(2)}R)` : ""}`)
    .join("\n");
  const checklistLines = verdict.checklist.map((c) => `- ${c.label}: ${c.pass === true ? "PASS" : c.pass === false ? "FAIL" : "n/a"} (${c.value})`).join("\n");
  const probLines = verdict.probability
    ? `pFill ${verdict.probability.pFill ?? "n/a"} · pT1 ${verdict.probability.pT1 ?? "n/a"} · pMeanRevert ${verdict.probability.pMeanRevert ?? "n/a"} · EV ${verdict.probability.evR ?? "n/a"}R · σ_bar ${verdict.probability.sigmaBar ?? "n/a"}`
    : "n/a";

  const system = [
    "You are a risk-first trading desk analyst writing a SHORT brief (max ~220 words) for one instrument.",
    "HARD RULES: cite ONLY the numbers in the supplied telemetry — never invent prices, probabilities or data. If a field is n/a, say so.",
    "Structure: (1) one-line state of the setup, (2) the strongest confirming evidence, (3) the strongest RISK / blindspot that could invalidate it (stale fields, missing feeds, correlation/crowding, funding cost), (4) one concrete invalidation level to watch.",
    "No investment advice disclaimers, no preamble, no markdown headers — plain short lines.",
  ].join(" ");

  const user = [
    `SYMBOL: ${sym} (${verdict.name}, ${verdict.kind})`,
    `REGIME: ${verdict.regime} — ${verdict.regimeNote}`,
    `MODEL: ${verdict.activeModel} · direction ${verdict.direction} · grade ${verdict.grade} · confidence ${verdict.confidence}/100`,
    `THESIS: ${verdict.thesis}`,
    `PLAN: entry ${verdict.plan.entryZone ? `${verdict.plan.entryZone[0]}–${verdict.plan.entryZone[1]}` : "n/a"} · stop ${verdict.plan.stop ?? "n/a"} · bestR ${verdict.plan.bestR ?? "n/a"}`,
    planLines,
    `PROBABILITY: ${probLines}`,
    `CHECKLIST:`,
    checklistLines,
    `FRESHNESS: worst age ${Math.round((verdict.freshness?.worstAgeMs ?? 0) / 1000)}s · stale fields: ${verdict.freshness?.staleFields?.join(", ") || "none"}`,
    `QUANT: ${quant ? `OI-weighted funding APR ${quant.fundingAprPct ?? "n/a"}% · OI 4h quadrant ${quant.oiQuadrant4h ?? "n/a"} · top-trader L/S ${quant.topLs ?? "n/a"}${quant.coinbasePremiumBps != null ? ` · Coinbase premium ${quant.coinbasePremiumBps}bps` : ""}` : "n/a"}`,
    `OPTIONS: ${options ? `GEX ${options.gexRegime ?? "n/a"} · RR25d ${options.rr25d ?? "n/a"} · DVOL ${options.dvol ?? "n/a"}` : "n/a (BTC/ETH only)"}`,
    `M1 STATUS: ${verdict.m1?.status ?? "n/a"} — ${verdict.m1?.note ?? ""}`,
    `M2 STATUS: ${verdict.m2?.status ?? "n/a"} — ${verdict.m2?.note ?? ""}`,
  ].join("\n");

  // stream the upstream SSE through to the client, accumulating for the cache
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const startedAt = Date.now();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let acc = "";
      let sentAny = false;
      try {
        const res = await fetch(`${AI_BASE}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: AI_MODEL,
            stream: true,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            temperature: 0.2,
            max_tokens: 600,
          }),
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });
        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => "");
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: `upstream ${res.status}${errText ? `: ${errText.slice(0, 180)}` : ""}` })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        const reader = res.body.getReader();
        let buf = "";
        for (;;) {
          if (Date.now() - startedAt > UPSTREAM_TIMEOUT_MS) throw new Error("upstream timeout (120 s)");
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const payload = t.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const j = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
              const piece = j.choices?.[0]?.delta?.content;
              if (piece) {
                acc += piece;
                sentAny = true;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: piece })}\n\n`));
              }
            } catch {
              /* skip malformed chunk */
            }
          }
        }
        if (acc) {
          // 15-min cache keyed by (sym, barTs)
          cache.set(cacheKey, { at: Date.now(), text: acc, sym });
          if (cache.size > 80) {
            const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
            if (oldest) cache.delete(oldest[0]);
          }
          if (!sentAny) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: acc })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", ms: Date.now() - startedAt, cached: false })}\n\n`));
      } catch (e) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: e instanceof Error ? e.message : "stream failed" })}\n\n`));
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      "x-cg-ai-model": AI_MODEL,
    },
  });
}
