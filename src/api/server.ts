/**
 * HTTP API for the golden path + commitment sweep.
 * Sweep routes stay authenticated; POC app routes are open (single-tenant, no auth UI).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { assertSweepSecret, SweepAuthError } from "./sweepAuth.js";
import {
  assertPdfBytes,
  parseUploadFilename,
  PdfUploadError,
} from "./pdfUpload.js";
import { runSweep } from "../commitments/sweep.js";
import { ensureSession } from "../bootstrap/session.js";
import { seedDemoDocument } from "../documents/demoSeed.js";
import {
  confirmDocument,
  correctFigures,
  getConfirmationView,
  getConfirmedFiguresForAdvice,
  ingestFinancialPdf,
  rejectDocument,
  DocumentNotFoundError,
  InvalidDocumentStateError,
  OutOfCreditsError as DocCreditsError,
} from "../documents/service.js";
import {
  EmptyExtractionError,
  NotFinancialStatementError,
} from "../documents/extraction.js";
import { UnbalancedFiguresError } from "../documents/validate.js";
import { firstReading, OutOfCreditsError as EngineCreditsError } from "../advisors/engine.js";
import {
  DEMO_COMMITMENT_DUE,
  DEMO_COMMITMENT_TEXT,
  DEMO_PREVIOUS_FIGURES,
} from "../llm/demoFigures.js";
import {
  CommitmentNotFoundError,
  createCommitment,
  listCommitments,
  transitionCommitment,
} from "../commitments/service.js";
import {
  InvalidTransitionError,
  MissingTransitionFieldError,
  type StoredStatus,
} from "../commitments/stateMachine.js";
import { tryHandleConversationRequest } from "./conversations.js";
import { tryHandleRailRequest } from "./rail.js";
import {
  attachChatDocument,
  AttachUploadError,
  loadDocumentFile,
  parseAttachFilename,
} from "../documents/attach.js";

async function readBodyBuffer(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function readBody(req: IncomingMessage): Promise<string> {
  return (await readBodyBuffer(req)).toString("utf8");
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const raw = await readBody(req);
  if (!raw.trim()) return {};
  return JSON.parse(raw) as unknown;
}

function cors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Sweep-Secret, X-Owner-Id, X-Filename",
  );
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void {
  cors(res);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function ownerFrom(req: IncomingMessage, body?: Record<string, unknown>): string {
  const header = req.headers["x-owner-id"];
  if (typeof header === "string" && header.trim()) return header.trim();
  const fromBody = body?.ownerId;
  if (typeof fromBody === "string" && fromBody.trim()) return fromBody.trim();
  const url = new URL(req.url ?? "/", "http://localhost");
  const fromQuery = url.searchParams.get("ownerId");
  if (fromQuery?.trim()) return fromQuery.trim();
  const env = process.env.OWNER_ID?.trim();
  if (env) return env;
  throw new Error("Missing ownerId (header X-Owner-Id, body.ownerId, or OWNER_ID).");
}

function match(
  pathname: string,
  pattern: string,
): Record<string, string> | null {
  const pp = pattern.split("/").filter(Boolean);
  const ap = pathname.split("/").filter(Boolean);
  if (pp.length !== ap.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    const p = pp[i]!;
    const a = ap[i]!;
    if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(a);
    else if (p !== a) return null;
  }
  return params;
}

/** Legacy sweep-only handler (tests + GitHub Actions). */
export async function handleSweepRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const { pathname } = url;

    if (req.method === "GET" && (pathname === "/health" || pathname === "/")) {
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

export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  const { pathname } = url;

  try {
    if (req.method === "GET" && (pathname === "/health" || pathname === "/")) {
      sendJson(res, 200, { ok: true });
      return;
    }

    // --- Sweep (authenticated) ---
    if (pathname === "/api/sweep") {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "Method not allowed" });
        return;
      }
      assertSweepSecret(req.headers);
      await readBody(req);
      const result = await runSweep();
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    // --- Session bootstrap ---
    if (pathname === "/api/session" && req.method === "POST") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const sessionArgs: {
        ownerId?: string;
        ownerName?: string;
        timezone?: string;
      } = {};
      if (typeof body.ownerId === "string") sessionArgs.ownerId = body.ownerId;
      if (typeof body.ownerName === "string") sessionArgs.ownerName = body.ownerName;
      if (typeof body.timezone === "string") sessionArgs.timezone = body.timezone;
      const session = await ensureSession(sessionArgs);
      sendJson(res, 200, { ok: true, ...session });
      return;
    }

    // --- LLM provider status (UI hint: mock vs Anthropic) ---
    if (pathname === "/api/llm/status" && req.method === "GET") {
      const configured = (process.env.LLM_PROVIDER ?? "anthropic").toLowerCase();
      const hasKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
      const active =
        configured === "mock" || (configured === "anthropic" && !hasKey)
          ? "mock"
          : configured;
      sendJson(res, 200, {
        ok: true,
        configured,
        active,
        anthropicKeyConfigured: hasKey,
      });
      return;
    }

    // --- Demo document (no Claude) ---
    if (pathname === "/api/documents/demo" && req.method === "POST") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const ownerId = ownerFrom(req, body);
      const view = await seedDemoDocument(ownerId);
      sendJson(res, 200, {
        ok: true,
        ...view,
        fileName: "estados_2026_jun.pdf",
        source: "demo",
      });
      return;
    }

    // --- Real PDF upload → extract (Claude when key set, else mock) ---
    if (pathname === "/api/documents/upload" && req.method === "POST") {
      const ownerId = ownerFrom(req);
      const fileName = parseUploadFilename(req.headers["x-filename"]);
      const contentType = String(req.headers["content-type"] ?? "")
        .split(";")[0]!
        .trim()
        .toLowerCase();
      if (
        contentType &&
        contentType !== "application/pdf" &&
        contentType !== "application/octet-stream"
      ) {
        sendJson(res, 415, {
          error:
            "Content-Type debe ser application/pdf. Enviá el archivo como cuerpo binario.",
        });
        return;
      }
      const pdfBytes = await readBodyBuffer(req);
      assertPdfBytes(pdfBytes);
      const view = await ingestFinancialPdf({
        ownerId,
        pdfBytes,
        originalPath: fileName,
      });
      sendJson(res, 200, {
        ok: true,
        ...view,
        fileName,
        source: "upload",
      });
      return;
    }

    // --- Chat attachment (view 1b: document beside advisor) ---
    {
      const m = match(pathname, "/api/conversations/:id/attachments");
      if (m && req.method === "POST") {
        const ownerId = ownerFrom(req);
        const fileName = parseAttachFilename(req.headers["x-filename"]);
        const bytes = await readBodyBuffer(req);
        const meta = await attachChatDocument({
          ownerId,
          conversationId: m.id!,
          bytes,
          fileName,
        });
        sendJson(res, 201, { ok: true, attachment: meta });
        return;
      }
    }

    // --- Serve stored original file bytes ---
    {
      const m = match(pathname, "/api/documents/:id/file");
      if (m && req.method === "GET") {
        const ownerId = ownerFrom(req);
        const file = await loadDocumentFile(ownerId, m.id!);
        if (!file) {
          sendJson(res, 404, { error: "Document file not found" });
          return;
        }
        cors(res);
        res.writeHead(200, {
          "content-type": file.mimeType,
          "content-length": file.bytes.length,
          "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
          "cache-control": "private, max-age=60",
        });
        res.end(file.bytes);
        return;
      }
    }

    // --- Confirmation view ---
    {
      const m = match(pathname, "/api/documents/:id/confirmation");
      if (m && req.method === "GET") {
        const ownerId = ownerFrom(req);
        const view = await getConfirmationView(ownerId, m.id!);
        sendJson(res, 200, { ok: true, ...view });
        return;
      }
    }

    // --- Correct figures ---
    {
      const m = match(pathname, "/api/documents/:id/figures");
      if (m && req.method === "PATCH") {
        const body = (await readJson(req)) as Record<string, unknown>;
        const ownerId = ownerFrom(req, body);
        const corrections = body.corrections;
        if (!Array.isArray(corrections)) {
          sendJson(res, 400, { error: "corrections array required" });
          return;
        }
        const view = await correctFigures({
          ownerId,
          documentId: m.id!,
          corrections: corrections as Array<{
            figureId: string;
            value: number;
            lineItem?: string;
          }>,
        });
        sendJson(res, 200, { ok: true, ...view });
        return;
      }
    }

    // --- Confirm ---
    {
      const m = match(pathname, "/api/documents/:id/confirm");
      if (m && req.method === "POST") {
        const body = (await readJson(req)) as Record<string, unknown>;
        const ownerId = ownerFrom(req, body);
        const view = await confirmDocument(ownerId, m.id!);
        sendJson(res, 200, { ok: true, ...view });
        return;
      }
    }

    // --- Reject ---
    {
      const m = match(pathname, "/api/documents/:id/reject");
      if (m && req.method === "POST") {
        const body = (await readJson(req)) as Record<string, unknown>;
        const ownerId = ownerFrom(req, body);
        const view = await rejectDocument(ownerId, m.id!);
        sendJson(res, 200, { ok: true, ...view });
        return;
      }
    }

    // --- First reading (streams NDJSON deltas, then final) ---
    if (pathname === "/api/readings/first" && req.method === "POST") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const ownerId = ownerFrom(req, body);
      const profileId = String(body.profileId ?? "");
      const conversationId = String(body.conversationId ?? "");
      const documentId = String(body.documentId ?? "");
      if (!profileId || !conversationId || !documentId) {
        sendJson(res, 400, {
          error: "profileId, conversationId, and documentId are required",
        });
        return;
      }

      const currentFigures = await getConfirmedFiguresForAdvice(ownerId, documentId);

      cors(res);
      res.writeHead(200, {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache",
      });

      const writeLine = (obj: Record<string, unknown>) => {
        res.write(JSON.stringify(obj) + "\n");
      };

      try {
        const result = await firstReading({
          ownerId,
          profileId,
          conversationId,
          previousFigures: DEMO_PREVIOUS_FIGURES,
          currentFigures,
          onDelta: (chunk) => writeLine({ type: "delta", text: chunk }),
        });

        writeLine({
          type: "done",
          operationId: result.operationId,
          reading: result.reading,
          model: result.model,
          recommendationId: result.recommendationId,
          suggestedCommitment: {
            text: DEMO_COMMITMENT_TEXT,
            dueDate: DEMO_COMMITMENT_DUE,
          },
        });
      } catch (streamErr) {
        console.error("first reading failed", streamErr);
        writeLine({
          type: "error",
          error:
            streamErr instanceof Error ? streamErr.message : "First reading failed",
        });
      }
      res.end();
      return;
    }

    // --- Commitments list ---
    if (pathname === "/api/commitments" && req.method === "GET") {
      const ownerId = ownerFrom(req);
      const items = await listCommitments(ownerId);
      sendJson(res, 200, { ok: true, items });
      return;
    }

    // --- Create commitment ---
    if (pathname === "/api/commitments" && req.method === "POST") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const ownerId = ownerFrom(req, body);
      const recommendationId = String(body.recommendationId ?? "");
      const text = String(body.text ?? DEMO_COMMITMENT_TEXT);
      const dueDate = String(body.dueDate ?? DEMO_COMMITMENT_DUE);
      if (!recommendationId) {
        sendJson(res, 400, { error: "recommendationId is required" });
        return;
      }
      const item = await createCommitment({
        ownerId,
        recommendationId,
        text,
        dueDate,
      });
      sendJson(res, 201, { ok: true, item });
      return;
    }

    // --- Transition commitment ---
    {
      const m = match(pathname, "/api/commitments/:id/transition");
      if (m && req.method === "POST") {
        const body = (await readJson(req)) as Record<string, unknown>;
        const ownerId = ownerFrom(req, body);
        const to = String(body.to ?? "") as StoredStatus;
        const payload: {
          dismissedReason?: string;
          deferredTo?: string;
          closedEvidence?: string;
        } = {};
        if (typeof body.dismissedReason === "string") {
          payload.dismissedReason = body.dismissedReason;
        }
        if (typeof body.deferredTo === "string") {
          payload.deferredTo = body.deferredTo;
        }
        if (typeof body.closedEvidence === "string") {
          payload.closedEvidence = body.closedEvidence;
        }
        const item = await transitionCommitment({
          ownerId,
          commitmentId: m.id!,
          to,
          payload,
        });
        sendJson(res, 200, { ok: true, item });
        return;
      }
    }

    const claimedRail = await tryHandleRailRequest({
      req,
      res,
      pathname,
      ownerFrom,
      readJson,
      sendJson,
    });
    if (claimedRail) return;

    const claimedConversation = await tryHandleConversationRequest({
      req,
      res,
      pathname,
      ownerFrom,
      readJson,
      sendJson,
    });
    if (claimedConversation) return;

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    if (res.headersSent) {
      console.error("api error after headers sent", err);
      try {
        res.end();
      } catch {
        /* ignore */
      }
      return;
    }
    if (err instanceof SweepAuthError) {
      sendJson(res, 401, { error: err.message });
      return;
    }
    if (
      err instanceof DocumentNotFoundError ||
      err instanceof CommitmentNotFoundError
    ) {
      sendJson(res, 404, { error: err.message });
      return;
    }
    if (err instanceof PdfUploadError) {
      sendJson(res, err.status, { error: err.message });
      return;
    }
    if (err instanceof AttachUploadError) {
      sendJson(res, err.status, { error: err.message });
      return;
    }
    if (
      err instanceof NotFinancialStatementError ||
      err instanceof EmptyExtractionError
    ) {
      sendJson(res, 422, { error: err.message });
      return;
    }
    if (
      err instanceof InvalidDocumentStateError ||
      err instanceof UnbalancedFiguresError ||
      err instanceof InvalidTransitionError ||
      err instanceof MissingTransitionFieldError
    ) {
      sendJson(res, 409, { error: err.message });
      return;
    }
    if (err instanceof DocCreditsError || err instanceof EngineCreditsError) {
      sendJson(res, 402, { error: err.message, operationId: err.operationId });
      return;
    }
    if (err instanceof SyntaxError) {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }
    console.error("api error", err);
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : "Request failed",
    });
  }
}

/** Start the API server (health, sweep, golden-path routes). */
export function startSweepServer(port = Number(process.env.PORT ?? 8787)) {
  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });
  server.listen(port, () => {
    console.log(
      `API listening on :${port} (GET /health, POST /api/sweep, golden-path /api/*)`,
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
