/**
 * Commitment persistence (create from recommendation, list, transition).
 * Overdue is computed on read — never stored (D-033).
 */
import { getPool, withTransaction } from "../db/pool.js";
import {
  applyTransition,
  computeDisplayStatus,
  type CommitmentFields,
  type DisplayStatus,
  type StoredStatus,
  type TransitionPayload,
} from "./stateMachine.js";

export interface CommitmentRecord {
  id: string;
  recommendationId: string;
  text: string;
  dueDate: string;
  deferredTo: string | null;
  dismissedReason: string | null;
  closedEvidence: string | null;
  status: StoredStatus;
  displayStatus: DisplayStatus;
  origin: string;
  createdAt: string;
}

export class CommitmentNotFoundError extends Error {
  constructor(id: string) {
    super(`Commitment ${id} not found.`);
    this.name = "CommitmentNotFoundError";
  }
}

export async function createCommitment(args: {
  ownerId: string;
  recommendationId: string;
  text: string;
  dueDate: string; // yyyy-mm-dd
}): Promise<CommitmentRecord> {
  const pool = getPool();
  const { rows: rec } = await pool.query<{ id: string }>(
    `SELECT id FROM recommendations WHERE id = $1 AND owner_id = $2`,
    [args.recommendationId, args.ownerId],
  );
  if (!rec[0]) {
    throw new Error(
      `Recommendation ${args.recommendationId} not found for this owner.`,
    );
  }

  const { rows } = await pool.query<{
    id: string;
    recommendation_id: string;
    text: string;
    due_date: string;
    status: StoredStatus;
    deferred_to: string | null;
    dismissed_reason: string | null;
    closed_evidence: string | null;
    created_at: Date;
  }>(
    `INSERT INTO commitments
       (owner_id, recommendation_id, text, due_date, status)
     VALUES ($1, $2, $3, $4::date, 'pending')
     RETURNING id, recommendation_id, text, due_date::text, status,
               deferred_to::text, dismissed_reason, closed_evidence, created_at`,
    [args.ownerId, args.recommendationId, args.text, args.dueDate],
  );
  const row = rows[0]!;
  const timezone = await ownerTimezone(args.ownerId);
  return toRecord(row, timezone);
}

export async function listCommitments(
  ownerId: string,
): Promise<CommitmentRecord[]> {
  const pool = getPool();
  const timezone = await ownerTimezone(ownerId);
  const { rows } = await pool.query<{
    id: string;
    recommendation_id: string;
    text: string;
    due_date: string;
    status: StoredStatus;
    deferred_to: string | null;
    dismissed_reason: string | null;
    closed_evidence: string | null;
    created_at: Date;
    advisor_id: string | null;
  }>(
    `SELECT c.id, c.recommendation_id, c.text, c.due_date::text, c.status,
            c.deferred_to::text, c.dismissed_reason, c.closed_evidence, c.created_at,
            r.advisor_id
       FROM commitments c
       LEFT JOIN recommendations r ON r.id = c.recommendation_id
      WHERE c.owner_id = $1
      ORDER BY c.created_at DESC`,
    [ownerId],
  );
  return rows.map((row) => toRecord(row, timezone, row.advisor_id));
}

export async function transitionCommitment(args: {
  ownerId: string;
  commitmentId: string;
  to: StoredStatus;
  payload?: TransitionPayload;
}): Promise<CommitmentRecord> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{
      id: string;
      recommendation_id: string;
      text: string;
      due_date: string;
      status: StoredStatus;
      deferred_to: string | null;
      dismissed_reason: string | null;
      closed_evidence: string | null;
      created_at: Date;
    }>(
      `SELECT id, recommendation_id, text, due_date::text, status,
              deferred_to::text, dismissed_reason, closed_evidence, created_at
         FROM commitments
        WHERE id = $1 AND owner_id = $2
        FOR UPDATE`,
      [args.commitmentId, args.ownerId],
    );
    const row = rows[0];
    if (!row) throw new CommitmentNotFoundError(args.commitmentId);

    const current: CommitmentFields = {
      status: row.status,
      dueDate: row.due_date,
      deferredTo: row.deferred_to,
      dismissedReason: row.dismissed_reason,
      closedEvidence: row.closed_evidence,
    };
    const next = applyTransition(current, args.to, args.payload ?? {});

    const { rows: updated } = await client.query<{
      id: string;
      recommendation_id: string;
      text: string;
      due_date: string;
      status: StoredStatus;
      deferred_to: string | null;
      dismissed_reason: string | null;
      closed_evidence: string | null;
      created_at: Date;
    }>(
      `UPDATE commitments
          SET status = $1,
              deferred_to = $2::date,
              dismissed_reason = $3,
              closed_evidence = $4,
              updated_at = now()
        WHERE id = $5 AND owner_id = $6
      RETURNING id, recommendation_id, text, due_date::text, status,
                deferred_to::text, dismissed_reason, closed_evidence, created_at`,
      [
        next.status,
        next.deferredTo,
        next.dismissedReason,
        next.closedEvidence,
        args.commitmentId,
        args.ownerId,
      ],
    );
    const timezone = await ownerTimezone(args.ownerId);
    return toRecord(updated[0]!, timezone);
  });
}

async function ownerTimezone(ownerId: string): Promise<string> {
  const { rows } = await getPool().query<{ timezone: string }>(
    `SELECT timezone FROM owners WHERE id = $1`,
    [ownerId],
  );
  return rows[0]?.timezone ?? "America/Costa_Rica";
}

function toRecord(
  row: {
    id: string;
    recommendation_id: string;
    text: string;
    due_date: string;
    status: StoredStatus;
    deferred_to: string | null;
    dismissed_reason: string | null;
    closed_evidence: string | null;
    created_at: Date;
  },
  timezone: string,
  advisorId?: string | null,
): CommitmentRecord {
  const fields: CommitmentFields = {
    status: row.status,
    dueDate: row.due_date,
    deferredTo: row.deferred_to,
    dismissedReason: row.dismissed_reason,
    closedEvidence: row.closed_evidence,
  };
  return {
    id: row.id,
    recommendationId: row.recommendation_id,
    text: row.text,
    dueDate: row.due_date,
    deferredTo: row.deferred_to,
    dismissedReason: row.dismissed_reason,
    closedEvidence: row.closed_evidence,
    status: row.status,
    displayStatus: computeDisplayStatus(fields, timezone),
    origin: advisorId === "financiero" || advisorId === "finance"
      ? "Financiero"
      : advisorId ?? "Board",
    createdAt: row.created_at.toISOString(),
  };
}
