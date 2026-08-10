/**
 * HTTP surface for the commitment sweep (T8).
 * GitHub Actions (and later host cron) POST /api/sweep with the shared secret.
 * Logic lives in commitments/sweep.ts — swapping the trigger does not rewrite it.
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

export async function handleSweepRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.writeHead(405, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/api/sweep") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    assertSweepSecret(req.headers);

    // Body optional; drain so clients using Content-Length don't hang.
    await readBody(req);

    const result = await runSweep();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, ...result }));
  } catch (err) {
    if (err instanceof SweepAuthError) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
    console.error("sweep failed", err);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Sweep failed",
      }),
    );
  }
}

/** Start a tiny server that only serves POST /api/sweep. */
export function startSweepServer(port = Number(process.env.PORT ?? 8787)) {
  const server = createServer((req, res) => {
    void handleSweepRequest(req, res);
  });
  server.listen(port, () => {
    console.log(`Sweep endpoint listening on :${port} (POST /api/sweep)`);
  });
  return server;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  startSweepServer();
}
