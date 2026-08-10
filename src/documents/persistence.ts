/**
 * Persistence for documents / extracted_figures. Raw SQL, owner_id on every query (D-030).
 */
import type { PoolClient } from "pg";
import { withTransaction } from "../db/pool.js";
import type { Figure } from "../advisors/reconciliation.js";
import type { StatementSection } from "../advisors/sections.js";
import type { DocumentKind, DocumentStatus, ExtractedFigureRow } from "./types.js";

export interface DocumentRow {
  id: string;
  ownerId: string;
  kind: DocumentKind;
  status: DocumentStatus;
  periodStart: string | null;
  periodEnd: string | null;
}

export async function insertDocument(args: {
  ownerId: string;
  kind: DocumentKind;
  pdfBytes: Buffer;
  originalPath?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
}): Promise<string> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO documents
         (owner_id, kind, original_bytes, original_path, period_start, period_end, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'uploaded')
       RETURNING id`,
      [
        args.ownerId,
        args.kind,
        args.pdfBytes,
        args.originalPath ?? null,
        args.periodStart ?? null,
        args.periodEnd ?? null,
      ],
    );
    return rows[0]!.id;
  });
}

export async function replaceFigures(
  client: PoolClient,
  args: {
    ownerId: string;
    documentId: string;
    figures: Figure[];
  },
): Promise<void> {
  await client.query(
    `DELETE FROM extracted_figures WHERE document_id = $1 AND owner_id = $2`,
    [args.documentId, args.ownerId],
  );
  for (const f of args.figures) {
    await client.query(
      `INSERT INTO extracted_figures
         (owner_id, document_id, line_item, value, statement_section,
          confirmed_by_owner, corrected_by_owner)
       VALUES ($1, $2, $3, $4, $5, FALSE, FALSE)`,
      [args.ownerId, args.documentId, f.lineItem, f.value, f.statementSection],
    );
  }
}

export async function setDocumentStatus(
  client: PoolClient,
  args: {
    ownerId: string;
    documentId: string;
    status: DocumentStatus;
    /** When provided (including null), overwrites period columns. */
    periodStart?: string | null;
    periodEnd?: string | null;
  },
): Promise<void> {
  const touchPeriods =
    args.periodStart !== undefined || args.periodEnd !== undefined;
  if (touchPeriods) {
    await client.query(
      `UPDATE documents
          SET status = $1,
              period_start = $2,
              period_end = $3,
              updated_at = now()
        WHERE id = $4 AND owner_id = $5`,
      [
        args.status,
        args.periodStart ?? null,
        args.periodEnd ?? null,
        args.documentId,
        args.ownerId,
      ],
    );
  } else {
    await client.query(
      `UPDATE documents
          SET status = $1, updated_at = now()
        WHERE id = $2 AND owner_id = $3`,
      [args.status, args.documentId, args.ownerId],
    );
  }
}

export async function loadDocument(
  ownerId: string,
  documentId: string,
): Promise<DocumentRow | null> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{
      id: string;
      owner_id: string;
      kind: DocumentKind;
      status: DocumentStatus;
      period_start: string | null;
      period_end: string | null;
    }>(
      `SELECT id, owner_id, kind, status,
              period_start::text, period_end::text
         FROM documents
        WHERE id = $1 AND owner_id = $2`,
      [documentId, ownerId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      ownerId: row.owner_id,
      kind: row.kind,
      status: row.status,
      periodStart: row.period_start,
      periodEnd: row.period_end,
    };
  });
}

export async function loadFigures(
  ownerId: string,
  documentId: string,
): Promise<ExtractedFigureRow[]> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{
      id: string;
      line_item: string;
      value: string;
      statement_section: StatementSection;
      confirmed_by_owner: boolean;
      corrected_by_owner: boolean;
    }>(
      `SELECT id, line_item, value::text, statement_section,
              confirmed_by_owner, corrected_by_owner
         FROM extracted_figures
        WHERE document_id = $1 AND owner_id = $2
        ORDER BY created_at, id`,
      [documentId, ownerId],
    );
    return rows.map((r) => ({
      id: r.id,
      lineItem: r.line_item,
      value: Number(r.value),
      statementSection: r.statement_section,
      confirmedByOwner: r.confirmed_by_owner,
      correctedByOwner: r.corrected_by_owner,
    }));
  });
}

export async function applyFigureCorrections(
  client: PoolClient,
  args: {
    ownerId: string;
    documentId: string;
    corrections: Array<{ figureId: string; value: number; lineItem?: string }>;
  },
): Promise<void> {
  for (const c of args.corrections) {
    const { rowCount } = await client.query(
      `UPDATE extracted_figures
          SET value = $1,
              line_item = COALESCE($2, line_item),
              corrected_by_owner = TRUE,
              confirmed_by_owner = FALSE
        WHERE id = $3 AND document_id = $4 AND owner_id = $5`,
      [
        c.value,
        c.lineItem ?? null,
        c.figureId,
        args.documentId,
        args.ownerId,
      ],
    );
    if (rowCount !== 1) {
      throw new Error(`Figure ${c.figureId} not found on document ${args.documentId}.`);
    }
  }
}

export async function markFiguresConfirmed(
  client: PoolClient,
  args: { ownerId: string; documentId: string },
): Promise<void> {
  await client.query(
    `UPDATE extracted_figures
        SET confirmed_by_owner = TRUE
      WHERE document_id = $1 AND owner_id = $2`,
    [args.documentId, args.ownerId],
  );
}
