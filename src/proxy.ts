import { NextRequest, NextResponse } from "next/server";

/**
 * Same-origin guard for mutating API routes (Next 16 `proxy` convention —
 * the successor of middleware.ts).
 *
 * POST /api/cg/engine/backfill is a CORS "simple request" (no custom headers,
 * no preflight) — any web page open in the user's browser could fire it at
 * http://localhost:3000 and trigger ~100 upstream requests. Enforce
 * Sec-Fetch-Site / Origin before the route handler runs. GET/HEAD are exempt
 * (read-only, harmless, and used by MCP / polling clients).
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
  if (req.method !== "GET" && req.method !== "HEAD") {
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
