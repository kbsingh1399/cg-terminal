import { NextResponse } from "next/server";
import { accountSnapshot, binanceCreds } from "@/lib/binance/signed";

export const dynamic = "force-dynamic";

/**
 * GET /api/binance/account — the demo (testnet) trading account snapshot.
 *
 * 200 + ok:false when credentials are absent or rejected — the UI shows the
 * honest reason (a missing config is a state, not an HTTP error). Snapshots
 * are shared 5s server-side so any number of consumers cost one signed call.
 * NEVER returns the API key/secret — only derived, non-secret facts.
 */
export async function GET() {
  const creds = binanceCreds();
  if (!creds) {
    return NextResponse.json({
      ok: false,
      mode: null,
      error: "no BINANCE_API_KEY/SECRET in .env — market data works without keys; demo trading needs futures-testnet credentials (https://testnet.binancefuture.com)",
    });
  }
  const snap = await accountSnapshot();
  return NextResponse.json(snap);
}
