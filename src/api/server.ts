/**
 * HTTP surface for the commitment sweep (T8).
 * GitHub Actions (and later host cron) POST /api/sweep with the shared secret.
 * Logic lives in commitments/sweep.ts — swapping the trigger does not rewrite it.
 *
 * GET /health (and GET /) exist so free-tier hosts can health-check without
 * triggering the sweep.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { assertSweepSecret, SweepAuthError } from "./sweepAuth.js";
import { runSweep } from "../commitments/sweep.js";

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export async function handleSweepRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const { pathname } = url;

    if (
      req.method === "GET" &&
      (pathname === "/health" || pathname === "/")
    ) {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname !== "/api/sweep") {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    assertSweepSecret(req.headers);

    // Body optional; drain so clients using Content-Length don't hang.
    await readBody(req);

    const result = await runSweep();
    sendJson(res, 200, { ok: true, ...result });
  } catch (err) {
    if (err instanceof SweepAuthError) {
      sendJson(res, 401, { error: err.message });
      return;
    }
    console.error("sweep failed", err);
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : "Sweep failed",
    });
  }
}

/** Start a tiny server: health checks + POST /api/sweep. */
export function startSweepServer(port = Number(process.env.PORT ?? 8787)) {
  const server = createServer((req, res) => {
    void handleSweepRequest(req, res);
  });
  server.listen(port, () => {
    console.log(
      `Sweep endpoint listening on :${port} (GET /health, POST /api/sweep)`,
    );
  });
  return server;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  startSweepServer();
}
