/**
 * Seed a confirmed-ready extraction without calling Claude (demo / local golden path).
 */
import { withTransaction } from "../db/pool.js";
import {
  DEMO_CURRENT_FIGURES,
  DEMO_PERIOD_END,
  DEMO_PERIOD_START,
} from "../llm/demoFigures.js";
import {
  insertDocument,
  replaceFigures,
  setDocumentStatus,
} from "./persistence.js";
import { getConfirmationView } from "./service.js";
import type { ConfirmationView } from "./types.js";

const DEMO_PDF_STUB = Buffer.from(
  "%PDF-1.4\n% Board of Advisors demo stub (no real PDF bytes)\n",
  "utf8",
);

export async function seedDemoDocument(
  ownerId: string,
): Promise<ConfirmationView> {
  const documentId = await insertDocument({
    ownerId,
    kind: "financial_statement",
    pdfBytes: DEMO_PDF_STUB,
    originalPath: "estados_2026_jun.pdf",
    periodStart: DEMO_PERIOD_START,
    periodEnd: DEMO_PERIOD_END,
  });

  await withTransaction(async (client) => {
    await replaceFigures(client, {
      ownerId,
      documentId,
      figures: DEMO_CURRENT_FIGURES,
    });
    await setDocumentStatus(client, {
      ownerId,
      documentId,
      status: "extracted",
      periodStart: DEMO_PERIOD_START,
      periodEnd: DEMO_PERIOD_END,
    });
  });

  return getConfirmationView(ownerId, documentId);
}
