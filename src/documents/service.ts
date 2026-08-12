/**
 * Document ingestion service (Task 4 / D-028 / D-037).
 *
 * Flow: upload PDF → Claude native extract (every line) → arithmetic validation
 * → show figures for confirmation → owner confirms / corrects / rejects.
 * No advice until status=confirmed AND figures reconcile.
 */
import Anthropic from "@anthropic-ai/sdk";
import { withTransaction } from "../db/pool.js";
import { createProvider, type LlmProvider } from "../llm/client.js";
import { routeModel } from "../llm/router.js";
import {
  completeOperation,
  startOperation,
} from "../advisors/persistence.js";
import type { Figure } from "../advisors/reconciliation.js";
import { extractFiguresFromPdf } from "./extraction.js";
import {
  applyFigureCorrections,
  insertDocument,
  loadDocument,
  loadFigures,
  markFiguresConfirmed,
  replaceFigures,
  setDocumentStatus,
} from "./persistence.js";
import type { ConfirmationView } from "./types.js";
import { assertReadyForAdvice, validateFigures } from "./validate.js";

export class OutOfCreditsError extends Error {
  constructor(readonly operationId: string) {
    super(
      "Se acabaron los créditos de tu cuenta de Anthropic. Recargá y reintentá; " +
        "no se perdió nada, la operación se reanuda desde donde quedó.",
    );
    this.name = "OutOfCreditsError";
  }
}

export class DocumentNotFoundError extends Error {
  constructor(documentId: string) {
    super(`Document ${documentId} not found.`);
    this.name = "DocumentNotFoundError";
  }
}

export class InvalidDocumentStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDocumentStateError";
  }
}

function isCreditError(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 0;
    const msg = (err.message ?? "").toLowerCase();
    return (
      status === 402 ||
      ((status === 400 || status === 429) &&
        /credit|billing|insufficient|balance|quota/.test(msg))
    );
  }
  return false;
}

export interface DocumentServiceDeps {
  provider?: LlmProvider;
}

async function buildConfirmationView(
  ownerId: string,
  documentId: string,
): Promise<ConfirmationView> {
  const doc = await loadDocument(ownerId, documentId);
  if (!doc) throw new DocumentNotFoundError(documentId);
  const figures = await loadFigures(ownerId, documentId);
  const validation = validateFigures(figures);
  return {
    documentId: doc.id,
    status: doc.status,
    periodStart: doc.periodStart,
    periodEnd: doc.periodEnd,
    figures,
    validation,
    readyForAdvice: doc.status === "confirmed" && validation.ok,
    fileName: doc.originalPath,
  };
}

/**
 * Persist the PDF, extract every line item via Claude, validate arithmetic,
 * leave status=`extracted` for the confirmation screen.
 */
export async function ingestFinancialPdf(
  args: {
    ownerId: string;
    pdfBytes: Buffer;
    originalPath?: string;
  },
  deps: DocumentServiceDeps = {},
): Promise<ConfirmationView> {
  if (!args.pdfBytes.length) {
    throw new Error("El PDF está vacío.");
  }

  const provider = deps.provider ?? createProvider();
  const { model } = routeModel({ kind: "extraction" });

  const documentId = await insertDocument({
    ownerId: args.ownerId,
    kind: "financial_statement",
    pdfBytes: args.pdfBytes,
    ...(args.originalPath !== undefined ? { originalPath: args.originalPath } : {}),
  });

  const operationId = await startOperation({
    ownerId: args.ownerId,
    kind: "extraction",
    model,
    inputState: {
      documentId,
      originalPath: args.originalPath ?? null,
      byteLength: args.pdfBytes.length,
      model,
    },
  });

  let extracted;
  try {
    extracted = await extractFiguresFromPdf(provider, args.pdfBytes);
  } catch (err) {
    if (isCreditError(err)) {
      await completeOperation({
        ownerId: args.ownerId,
        operationId,
        status: "failed_credits",
      });
      throw new OutOfCreditsError(operationId);
    }
    await completeOperation({
      ownerId: args.ownerId,
      operationId,
      status: "failed_other",
    });
    throw err;
  }

  const { parsed, usage, model: usedModel } = extracted;

  await withTransaction(async (client) => {
    await replaceFigures(client, {
      ownerId: args.ownerId,
      documentId,
      figures: parsed.figures,
    });
    await setDocumentStatus(client, {
      ownerId: args.ownerId,
      documentId,
      status: "extracted",
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
    });
  });

  await completeOperation({
    ownerId: args.ownerId,
    operationId,
    status: "completed",
    usage,
    model: usedModel,
  });

  return buildConfirmationView(args.ownerId, documentId);
}

/** Confirmation-screen payload (figures + arithmetic flags). */
export async function getConfirmationView(
  ownerId: string,
  documentId: string,
): Promise<ConfirmationView> {
  return buildConfirmationView(ownerId, documentId);
}

/** Owner hand-corrects one or more extracted values before confirming. */
export async function correctFigures(args: {
  ownerId: string;
  documentId: string;
  corrections: Array<{ figureId: string; value: number; lineItem?: string }>;
}): Promise<ConfirmationView> {
  const doc = await loadDocument(args.ownerId, args.documentId);
  if (!doc) throw new DocumentNotFoundError(args.documentId);
  if (doc.status === "rejected") {
    throw new InvalidDocumentStateError("Cannot correct a rejected document.");
  }
  if (doc.status === "confirmed") {
    throw new InvalidDocumentStateError(
      "Document already confirmed. Reject and re-upload to change figures.",
    );
  }

  await withTransaction(async (client) => {
    await applyFigureCorrections(client, {
      ownerId: args.ownerId,
      documentId: args.documentId,
      corrections: args.corrections,
    });
    await setDocumentStatus(client, {
      ownerId: args.ownerId,
      documentId: args.documentId,
      status: "extracted",
    });
  });

  return buildConfirmationView(args.ownerId, args.documentId);
}

/**
 * Owner confirms the figures. Blocked when arithmetic does not reconcile (D-028).
 */
export async function confirmDocument(
  ownerId: string,
  documentId: string,
): Promise<ConfirmationView> {
  const doc = await loadDocument(ownerId, documentId);
  if (!doc) throw new DocumentNotFoundError(documentId);
  if (doc.status !== "extracted" && doc.status !== "uploaded") {
    throw new InvalidDocumentStateError(
      `Cannot confirm document in status '${doc.status}'.`,
    );
  }

  const figures = await loadFigures(ownerId, documentId);
  assertReadyForAdvice(figures);

  await withTransaction(async (client) => {
    await markFiguresConfirmed(client, { ownerId, documentId });
    await setDocumentStatus(client, {
      ownerId,
      documentId,
      status: "confirmed",
    });
  });

  return buildConfirmationView(ownerId, documentId);
}

/** Owner rejects the extraction entirely — free to re-upload. */
export async function rejectDocument(
  ownerId: string,
  documentId: string,
): Promise<ConfirmationView> {
  const doc = await loadDocument(ownerId, documentId);
  if (!doc) throw new DocumentNotFoundError(documentId);

  await withTransaction(async (client) => {
    await setDocumentStatus(client, {
      ownerId,
      documentId,
      status: "rejected",
    });
  });

  return buildConfirmationView(ownerId, documentId);
}

/**
 * Figures ready for advice (D-028). Throws if not confirmed or unbalanced.
 */
export async function getConfirmedFiguresForAdvice(
  ownerId: string,
  documentId: string,
): Promise<Figure[]> {
  const view = await buildConfirmationView(ownerId, documentId);
  if (view.status !== "confirmed") {
    throw new InvalidDocumentStateError(
      "No se genera consejo hasta que confirmes los números del estado financiero.",
    );
  }
  assertReadyForAdvice(view.figures);
  return view.figures.map((f) => ({
    lineItem: f.lineItem,
    value: f.value,
    statementSection: f.statementSection,
  }));
}
