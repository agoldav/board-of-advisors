/**
 * Commitment state machine (D-033).
 *
 * Stored states are: pending, done, deferred, dismissed.
 * `overdue` is NEVER stored — it is computed on read from the effective due date
 * and the OWNER's timezone. Using the server's timezone fires nudges a day early
 * or late, silently, so the owner timezone is a required input here.
 *
 *                     ┌──────────────► done       (evidence captured)
 *   pending ──────────┼──────────────► dismissed  (reason REQUIRED)
 *       │             └──────────────► deferred    (new due_date REQUIRED)
 *       │                                  │
 *       └─ [due passes] ─► (overdue, derived) ─► done | deferred | dismissed
 *
 * A deferred commitment re-enters the cycle on its new date; if that date also
 * passes it reads overdue again.
 */
import { DateTime } from "luxon";

export type StoredStatus = "pending" | "done" | "deferred" | "dismissed";
export type DisplayStatus = StoredStatus | "overdue";

const TERMINAL: ReadonlySet<StoredStatus> = new Set(["done", "dismissed"]);

/** Allowed stored->stored transitions. Terminal states go nowhere. */
export const TRANSITIONS: Record<StoredStatus, readonly StoredStatus[]> = {
  pending: ["done", "deferred", "dismissed"],
  deferred: ["done", "deferred", "dismissed"],
  done: [],
  dismissed: [],
};

export function canTransition(from: StoredStatus, to: StoredStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export interface TransitionPayload {
  /** Required when transitioning to "dismissed" — the highest-signal field. */
  dismissedReason?: string;
  /** Required when transitioning to "deferred". */
  deferredTo?: string; // ISO date (yyyy-mm-dd)
  /** Optional evidence captured when marking "done". */
  closedEvidence?: string;
}

export interface CommitmentFields {
  status: StoredStatus;
  dueDate: string; // ISO date
  deferredTo: string | null;
  dismissedReason: string | null;
  closedEvidence: string | null;
}

export class InvalidTransitionError extends Error {
  constructor(from: StoredStatus, to: StoredStatus) {
    super(`Invalid commitment transition: ${from} -> ${to}.`);
    this.name = "InvalidTransitionError";
  }
}

export class MissingTransitionFieldError extends Error {
  constructor(field: string, to: StoredStatus) {
    super(`Transition to "${to}" requires "${field}".`);
    this.name = "MissingTransitionFieldError";
  }
}

/**
 * Validate a transition and return the next stored fields. Pure — the caller
 * persists the result. Mirrors the DB CHECK constraints so bad states are caught
 * before they reach the database.
 */
export function applyTransition(
  current: CommitmentFields,
  to: StoredStatus,
  payload: TransitionPayload = {},
): CommitmentFields {
  if (TERMINAL.has(current.status)) {
    throw new InvalidTransitionError(current.status, to);
  }
  if (!canTransition(current.status, to)) {
    throw new InvalidTransitionError(current.status, to);
  }

  switch (to) {
    case "dismissed": {
      const reason = payload.dismissedReason?.trim();
      if (!reason) throw new MissingTransitionFieldError("dismissedReason", to);
      return {
        ...current,
        status: "dismissed",
        dismissedReason: reason,
      };
    }
    case "deferred": {
      const deferredTo = payload.deferredTo?.trim();
      if (!deferredTo) throw new MissingTransitionFieldError("deferredTo", to);
      return {
        ...current,
        status: "deferred",
        deferredTo,
      };
    }
    case "done": {
      return {
        ...current,
        status: "done",
        closedEvidence: payload.closedEvidence?.trim() || current.closedEvidence,
      };
    }
    case "pending":
      // No path re-enters pending; guarded above by canTransition.
      throw new InvalidTransitionError(current.status, to);
  }
}

/** The date a commitment is actually due: its deferral date if any, else due_date. */
export function effectiveDueDate(c: Pick<CommitmentFields, "dueDate" | "deferredTo">): string {
  return c.deferredTo ?? c.dueDate;
}

/**
 * Compute the DISPLAY status, including derived `overdue` (D-033).
 * @param ownerTimezone IANA tz, e.g. "America/Costa_Rica" — required.
 * @param now optional injected clock for tests (defaults to real now).
 */
export function computeDisplayStatus(
  c: CommitmentFields,
  ownerTimezone: string,
  now: DateTime = DateTime.now(),
): DisplayStatus {
  if (c.status === "done" || c.status === "dismissed") return c.status;

  const today = now.setZone(ownerTimezone).startOf("day");
  const due = DateTime.fromISO(effectiveDueDate(c), { zone: ownerTimezone }).startOf("day");
  if (!due.isValid) return c.status;

  // Overdue the day AFTER the due date passes, resolved in the owner's zone.
  return due < today ? "overdue" : c.status;
}

export function isOverdue(
  c: CommitmentFields,
  ownerTimezone: string,
  now?: DateTime,
): boolean {
  return computeDisplayStatus(c, ownerTimezone, now) === "overdue";
}
