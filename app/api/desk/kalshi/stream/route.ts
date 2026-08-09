// Kalshi realtime relay. Browsers can't sign Kalshi's WebSocket handshake
// (custom headers aren't allowed on browser WebSockets), so this route holds
// the authenticated socket server-side and relays ticker updates to the app
// as a server-sent-event stream. EventSource auto-reconnects when the
// function's time limit ends the stream, so the client sees a continuous
// feed. READ-ONLY: subscribes to public ticker channels, sends no orders.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

import crypto from "crypto";
import WebSocket from "ws";
import { requireDeskUser, readStore } from "../../../../../lib/desk";

type Creds = { keyId: string; privateKey: string };

const WS_PATH = "/trade-api/ws/v2";
const WS_URL = "wss://api.elections.kalshi.com" + WS_PATH;

function signedHeaders(creds: Creds) {
  const ts = Date.now().toString();
  const sig = crypto.sign("sha256", Buffer.from(ts + "GET" + WS_PATH), {
    key: creds.privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  }).toString("base64");
  return {
    "KALSHI-ACCESS-KEY": creds.keyId,
    "KALSHI-ACCESS-TIMESTAMP": ts,
    "KALSHI-ACCESS-SIGNATURE": sig,
  };
}

export async function GET(req: Request) {
  if (!(await requireDeskUser(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const creds = await readStore<Creds | null>("kalshi_creds", null);
  if (!creds || !creds.keyId) {
    return Response.json({ error: "Kalshi account is not connected." }, { status: 400 });
  }
  const tickers = (new URL(req.url).searchParams.get("tickers") || "")
    .split(",").map((t) => t.trim().toUpperCase()).filter(Boolean).slice(0, 25);
  if (!tickers.length) {
    return Response.json({ error: "tickers query param required" }, { status: 400 });
  }

  const enc = new TextEncoder();
  let ws: WebSocket | null = null;
  let beat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const push = (line: string) => {
        try { controller.enqueue(enc.encode(line)); } catch { /* stream gone */ }
      };
      const sendEvent = (obj: unknown) => push("data: " + JSON.stringify(obj) + "\n\n");
      const shutdown = () => {
        if (beat) { clearInterval(beat); beat = null; }
        try { ws && ws.close(); } catch { /* already down */ }
        try { controller.close(); } catch { /* already closed */ }
      };

      // Ask EventSource to retry quickly when this function times out.
      push("retry: 1500\n\n");

      ws = new WebSocket(WS_URL, { headers: signedHeaders(creds) });

      ws.on("open", () => {
        // ticker_v2 is the current channel; plain ticker kept as fallback —
        // an unknown-channel error on one is harmless.
        ws!.send(JSON.stringify({ id: 1, cmd: "subscribe", params: { channels: ["ticker_v2"], market_tickers: tickers } }));
        ws!.send(JSON.stringify({ id: 2, cmd: "subscribe", params: { channels: ["ticker"], market_tickers: tickers } }));
        sendEvent({ type: "hello", tickers });
      });

      ws.on("message", (buf) => {
        try {
          const d = JSON.parse(String(buf));
          if (d.type === "ticker" || d.type === "ticker_v2") sendEvent(d);
        } catch { /* non-JSON frame */ }
      });

      ws.on("error", () => shutdown());
      ws.on("close", () => shutdown());

      // SSE comment heartbeat keeps intermediaries from buffering/closing.
      beat = setInterval(() => push(": ping\n\n"), 15000);
    },
    cancel() {
      if (beat) { clearInterval(beat); beat = null; }
      try { ws && ws.close(); } catch { /* fine */ }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
