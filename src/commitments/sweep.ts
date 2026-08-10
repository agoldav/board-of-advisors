/**
 * Commitment follow-up sweep (D-029 / D-036 / T8).
 *
 * Computing overdue happens on every render (stateMachine). This module only
 * NOTIFIES without the app being open. The trigger (GitHub Actions today, host
 * cron later) must not change the logic — both call the same authenticated
 * endpoint that runs `runSweep`.
 *
 * Idempotency: followups.idempotency_key = commitment_id + ":" + scheduled_for.
 * Two sweeps in one day → one email.
 */
import { DateTime } from "luxon";
import { getPool, withTransaction } from "../db/pool.js";
import {
  computeDisplayStatus,
  effectiveDueDate,
  type CommitmentFields,
  type StoredStatus,
} from "./stateMachine.js";
import type { Mailer } from "./mailer.js";
import { createMailer } from "./mailer.js";

export function followupIdempotencyKey(
  commitmentId: string,
  scheduledFor: string,
): string {
  return `${commitmentId}:${scheduledFor}`;
}

export interface SweepCommitmentCandidate {
  id: string;
  ownerId: string;
  text: string;
  fields: CommitmentFields;
  ownerTimezone: string;
  ownerName: string;
}

export interface SweepSendResult {
  commitmentId: string;
  scheduledFor: string;
  sent: boolean;
  reason: "sent" | "already_sent" | "not_overdue";
}

export interface SweepResult {
  scanned: number;
  overdue: number;
  sent: number;
  skippedDuplicate: number;
  results: SweepSendResult[];
}

/** Pure filter: which open commitments read as overdue right now. */
export function filterOverdue(
  candidates: SweepCommitmentCandidate[],
  now: DateTime = DateTime.now(),
): SweepCommitmentCandidate[] {
  return candidates.filter(
    (c) => computeDisplayStatus(c.fields, c.ownerTimezone, now) === "overdue",
  );
}

function buildEmail(args: {
  to: string;
  ownerName: string;
  commitment: SweepCommitmentCandidate;
  scheduledFor: string;
}) {
  const due = effectiveDueDate(args.commitment.fields);
  return {
    to: args.to,
    subject: `Pendiente vencido: ${args.commitment.text.slice(0, 80)}`,
    body:
      `Hola ${args.ownerName},\n\n` +
      `El board te recuerda un compromiso vencido (vencía ${due}):\n\n` +
      `  ${args.commitment.text}\n\n` +
      `Abrí la app para marcarlo hecho, posponerlo o descartarlo (con motivo).\n`,
    commitmentId: args.commitment.id,
    scheduledFor: args.scheduledFor,
  };
}

async function loadOpenCommitments(): Promise<SweepCommitmentCandidate[]> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    owner_id: string;
    text: string;
    status: StoredStatus;
    due_date: string;
    deferred_to: string | null;
    dismissed_reason: string | null;
    closed_evidence: string | null;
    timezone: string;
    name: string;
  }>(
    `SELECT c.id, c.owner_id, c.text, c.status,
            c.due_date::text, c.deferred_to::text,
            c.dismissed_reason, c.closed_evidence,
            o.timezone, o.name
       FROM commitments c
       JOIN owners o ON o.id = c.owner_id
      WHERE c.status IN ('pending', 'deferred')
      ORDER BY c.owner_id, c.due_date`,
  );
  return rows.map((r) => ({
    id: r.id,
    ownerId: r.owner_id,
    text: r.text,
    ownerTimezone: r.timezone,
    ownerName: r.name,
    fields: {
      status: r.status,
      dueDate: r.due_date,
      deferredTo: r.deferred_to,
      dismissedReason: r.dismissed_reason,
      closedEvidence: r.closed_evidence,
    },
  }));
}

/**
 * Try to insert a followup row. Returns true if this run owns the send
 * (insert succeeded); false if the idempotency key already existed.
 */
export async function claimFollowupSend(args: {
  ownerId: string;
  commitmentId: string;
  scheduledFor: string;
  channel?: "email" | "in_app";
}): Promise<boolean> {
  const key = followupIdempotencyKey(args.commitmentId, args.scheduledFor);
  return withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `INSERT INTO followups
         (owner_id, commitment_id, scheduled_for, channel, idempotency_key)
       VALUES ($1, $2, $3::date, $4, $5)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        args.ownerId,
        args.commitmentId,
        args.scheduledFor,
        args.channel ?? "email",
        key,
      ],
    );
    return (rowCount ?? 0) === 1;
  });
}

export async function markFollowupSent(args: {
  commitmentId: string;
  scheduledFor: string;
}): Promise<void> {
  const key = followupIdempotencyKey(args.commitmentId, args.scheduledFor);
  await getPool().query(
    `UPDATE followups SET sent_at = now()
      WHERE idempotency_key = $1 AND sent_at IS NULL`,
    [key],
  );
}

export interface RunSweepDeps {
  mailer?: Mailer;
  notifyEmail?: string;
  now?: DateTime;
  /** Inject candidates to unit-test without a database. */
  candidates?: SweepCommitmentCandidate[];
  claim?: typeof claimFollowupSend;
  markSent?: typeof markFollowupSent;
}

/**
 * One sweep pass. Safe to call twice in the same day — duplicates are skipped.
 */
export async function runSweep(deps: RunSweepDeps = {}): Promise<SweepResult> {
  const mailer = deps.mailer ?? createMailer();
  const notifyEmail =
    deps.notifyEmail ?? process.env.OWNER_NOTIFY_EMAIL ?? "";
  const now = deps.now ?? DateTime.now();
  const claim = deps.claim ?? claimFollowupSend;
  const markSent = deps.markSent ?? markFollowupSent;

  if (!notifyEmail) {
    throw new Error(
      "OWNER_NOTIFY_EMAIL is not set; cannot send follow-up email (see .env.example).",
    );
  }

  const candidates = deps.candidates ?? (await loadOpenCommitments());
  const overdue = filterOverdue(candidates, now);

  const results: SweepSendResult[] = [];
  let sent = 0;
  let skippedDuplicate = 0;

  for (const c of overdue) {
    const scheduledFor = now.setZone(c.ownerTimezone).toISODate();
    if (!scheduledFor) {
      results.push({
        commitmentId: c.id,
        scheduledFor: "",
        sent: false,
        reason: "not_overdue",
      });
      continue;
    }

    const claimed = await claim({
      ownerId: c.ownerId,
      commitmentId: c.id,
      scheduledFor,
    });

    if (!claimed) {
      skippedDuplicate += 1;
      results.push({
        commitmentId: c.id,
        scheduledFor,
        sent: false,
        reason: "already_sent",
      });
      continue;
    }

    await mailer.send(
      buildEmail({
        to: notifyEmail,
        ownerName: c.ownerName,
        commitment: c,
        scheduledFor,
      }),
    );
    await markSent({ commitmentId: c.id, scheduledFor });
    sent += 1;
    results.push({
      commitmentId: c.id,
      scheduledFor,
      sent: true,
      reason: "sent",
    });
  }

  return {
    scanned: candidates.length,
    overdue: overdue.length,
    sent,
    skippedDuplicate,
    results,
  };
}
