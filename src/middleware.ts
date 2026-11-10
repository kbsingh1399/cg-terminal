import { NextRequest, NextResponse } from "next/server";

/**
 * Same-origin guard for mutating API routes.
 *
 * POST /api/cg/engine/backfill is a CORS "simple request" (no custom headers,
 * no preflight) — any web page open in the user's browser could fire it at
 * http://localhost:3000 and trigger ~100 upstream requests. Enforce
 * Sec-Fetch-Site / Origin before the route handler runs. GET/HEAD are exempt
 * (read-only, harmless, and used by MCP / polling clients).
 */
export function middleware(req: NextRequest) {
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
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
