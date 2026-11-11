import { NextRequest, NextResponse } from "next/server";

/**
 * Same-origin guard for API routes (Next 16 `proxy` convention — the
 * successor of middleware.ts).
 *
 * POST /api/cg/engine/backfill is a CORS "simple request" (no custom headers,
 * no preflight) — any web page open in the user's browser could fire it at
 * http://localhost:3000 and trigger ~100 upstream requests. Enforce
 * Sec-Fetch-Site / Origin before the route handler runs.
 *
 * GET/HEAD are ALSO blocked when the browser itself declares the request
 * cross-site: CORS stops a foreign page from READING /api/cg/* responses,
 * but the request still EXECUTES server-side — a victim's browser can be
 * made to boot the whole engine (GET /api/cg/assets → engineStatus() →
 * ensureEngine() → 15-asset upstream fan-out; GET /api/cg/engine/status)
 * or fingerprint server memory via /api/cg/debug/mem telemetry. That is a
 * CSRF-style denial-of-coffee/amplification surface, so Sec-Fetch-Site:
 * cross-site is rejected for every /api/* method. Only the explicit,
 * browser-set header is trusted: absent (curl, node fetch from MCP, python
 * desk scripts — intentional non-browser clients) or
 * same-origin/same-site/none (the app itself, new-tab navigations) pass.
 * Old browsers without Sec-Fetch-Site degrade to the pre-guard behavior.
 *
 * Host allowlist: Origin==Host alone does not survive DNS rebinding (both
 * headers come from the attacker's page). Mutating calls must arrive on a
 * loopback Host (or one listed in CG_ALLOWED_HOSTS for public previews).
 */
const HOST_ALLOWLIST = new Set(
  [
    "localhost:3000",
    "127.0.0.1:3000",
    "[::1]:3000",
    "localhost:81",
    "127.0.0.1:81",
    "[::1]:81",
    ...(process.env.CG_ALLOWED_HOSTS ? process.env.CG_ALLOWED_HOSTS.split(",").map((h) => h.trim()) : []),
  ].filter(Boolean)
);

export default function proxy(req: NextRequest) {
  // Cross-site browser requests are rejected for EVERY method (GET/HEAD
  // included — see the header comment: CORS blocks reading, not execution).
  // Header absent → non-browser client → fall through to the method checks.
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ ok: false, error: "cross-site API calls are not allowed" }, { status: 403 });
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    // (same-site intentionally NOT allowed for mutations — pre-existing,
    // stricter stance kept: mutations must be same-origin/none AND hit an
    // allowlisted Host below)
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") {
      return NextResponse.json({ ok: false, error: "cross-site API calls are not allowed" }, { status: 403 });
    }
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin && host) {
      let originHost = "";
      try {
        originHost = new URL(origin).host; // e.g. "localhost:3000"
      } catch {
        originHost = "invalid";
      }
      if (originHost !== host) {
        return NextResponse.json({ ok: false, error: "cross-origin API calls are not allowed" }, { status: 403 });
      }
    }
    // DNS-rebinding defense: the request must actually be addressed to a
    // local/allowed Host, not to an attacker-controlled name that rebinds
    if (host && !HOST_ALLOWLIST.has(host.toLowerCase())) {
      return NextResponse.json({ ok: false, error: "host not allowed for mutating calls" }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
