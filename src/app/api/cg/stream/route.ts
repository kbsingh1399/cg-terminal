import { NextRequest } from "next/server";
import { subscribe, type CgNotification } from "@/lib/cg/notify";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/stream — Server-Sent Events live notification stream.
 * Every new signal/wall/divergence event is pushed the moment the scanner
 * detects it. Keeps the terminal UI and any local listener live.
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let unsub: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    unsub?.();
    unsub = null;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
  };

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* closed */
        }
      };
      send("hello", { ok: true, ts: Date.now() });
      unsub = subscribe((n: CgNotification) => send("notification", n));
      heartbeat = setInterval(() => send("ping", { ts: Date.now() }), 25_000);
      heartbeat.unref?.();
    },
    cancel() {
      cleanup();
    },
  });

  // defense-in-depth: cancel() normally fires on socket close, but a
  // half-open connection (proxy kept alive, client gone) would otherwise
  // leak the subscriber + heartbeat forever — the request abort signal
  // fires reliably in that case too
  req.signal.addEventListener("abort", cleanup);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
