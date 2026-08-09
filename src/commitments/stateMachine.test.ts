import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import {
  applyTransition,
  canTransition,
  computeDisplayStatus,
  InvalidTransitionError,
  MissingTransitionFieldError,
  type CommitmentFields,
} from "./stateMachine.js";

const base: CommitmentFields = {
  status: "pending",
  dueDate: "2026-08-10",
  deferredTo: null,
  dismissedReason: null,
  closedEvidence: null,
};

const TZ = "America/Costa_Rica";

describe("transitions", () => {
  it("allows pending -> done/deferred/dismissed and blocks terminals", () => {
    expect(canTransition("pending", "done")).toBe(true);
    expect(canTransition("done", "deferred")).toBe(false);
    expect(canTransition("dismissed", "done")).toBe(false);
  });

  it("requires a reason to dismiss (D-033)", () => {
    expect(() => applyTransition(base, "dismissed")).toThrow(MissingTransitionFieldError);
    const next = applyTransition(base, "dismissed", { dismissedReason: "too expensive" });
    expect(next.status).toBe("dismissed");
    expect(next.dismissedReason).toBe("too expensive");
  });

  it("requires a new date to defer", () => {
    expect(() => applyTransition(base, "deferred")).toThrow(MissingTransitionFieldError);
    const next = applyTransition(base, "deferred", { deferredTo: "2026-09-01" });
    expect(next.status).toBe("deferred");
    expect(next.deferredTo).toBe("2026-09-01");
  });

  it("captures evidence on done", () => {
    const next = applyTransition(base, "done", { closedEvidence: "invoiced client" });
    expect(next.status).toBe("done");
    expect(next.closedEvidence).toBe("invoiced client");
  });

  it("rejects transitions out of terminal states", () => {
    const done = { ...base, status: "done" as const };
    expect(() => applyTransition(done, "deferred", { deferredTo: "2026-09-01" })).toThrow(
      InvalidTransitionError,
    );
  });
});

describe("overdue is computed on read in the owner timezone (D-033)", () => {
  const now = DateTime.fromISO("2026-08-15T12:00:00", { zone: TZ });

  it("marks a past-due pending commitment overdue", () => {
    expect(computeDisplayStatus(base, TZ, now)).toBe("overdue");
  });

  it("does not mark a future pending commitment overdue", () => {
    const future = { ...base, dueDate: "2026-08-20" };
    expect(computeDisplayStatus(future, TZ, now)).toBe("pending");
  });

  it("uses the deferral date when present", () => {
    const deferredFuture = { ...base, status: "deferred" as const, deferredTo: "2026-08-20" };
    expect(computeDisplayStatus(deferredFuture, TZ, now)).toBe("deferred");
    const deferredPast = { ...base, status: "deferred" as const, deferredTo: "2026-08-12" };
    expect(computeDisplayStatus(deferredPast, TZ, now)).toBe("overdue");
  });

  it("never marks terminal states overdue", () => {
    const past = { ...base, dueDate: "2026-01-01" };
    expect(computeDisplayStatus({ ...past, status: "done" }, TZ, now)).toBe("done");
    expect(computeDisplayStatus({ ...past, status: "dismissed" }, TZ, now)).toBe("dismissed");
  });

  it("respects the timezone boundary (due today is not overdue)", () => {
    const dueToday = { ...base, dueDate: "2026-08-15" };
    const earlyMorningCR = DateTime.fromISO("2026-08-15T00:30:00", { zone: TZ });
    expect(computeDisplayStatus(dueToday, TZ, earlyMorningCR)).toBe("pending");
  });
});
