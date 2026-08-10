import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import { RecordingMailer } from "./mailer.js";
import {
  filterOverdue,
  followupIdempotencyKey,
  runSweep,
  type SweepCommitmentCandidate,
} from "./sweep.js";

const TZ = "America/Costa_Rica";

function candidate(
  overrides: Partial<SweepCommitmentCandidate> & { id: string; dueDate: string },
): SweepCommitmentCandidate {
  return {
    id: overrides.id,
    ownerId: overrides.ownerId ?? "owner-1",
    text: overrides.text ?? "Revisar cobranza",
    ownerTimezone: overrides.ownerTimezone ?? TZ,
    ownerName: overrides.ownerName ?? "Abraham",
    fields: {
      status: overrides.fields?.status ?? "pending",
      dueDate: overrides.dueDate,
      deferredTo: overrides.fields?.deferredTo ?? null,
      dismissedReason: overrides.fields?.dismissedReason ?? null,
      closedEvidence: overrides.fields?.closedEvidence ?? null,
    },
  };
}

describe("followupIdempotencyKey", () => {
  it("is commitment_id + scheduled_for", () => {
    expect(followupIdempotencyKey("abc", "2026-08-09")).toBe("abc:2026-08-09");
  });
});

describe("filterOverdue", () => {
  const now = DateTime.fromISO("2026-08-12T15:00:00", { zone: TZ });

  it("selects only overdue open commitments in the owner timezone", () => {
    const list = [
      candidate({ id: "1", dueDate: "2026-08-10" }), // overdue
      candidate({ id: "2", dueDate: "2026-08-12" }), // due today — not overdue
      candidate({
        id: "3",
        dueDate: "2026-08-01",
        fields: {
          status: "done",
          dueDate: "2026-08-01",
          deferredTo: null,
          dismissedReason: null,
          closedEvidence: null,
        },
      }),
    ];
    const overdue = filterOverdue(list, now);
    expect(overdue.map((c) => c.id)).toEqual(["1"]);
  });
});

describe("runSweep idempotency", () => {
  const now = DateTime.fromISO("2026-08-12T15:00:00", { zone: TZ });
  const overdueOne = [
    candidate({ id: "c1", dueDate: "2026-08-01", text: "Cobrar factura X" }),
  ];

  it("sends once, then skips on a second sweep the same day", async () => {
    const mailer = new RecordingMailer();
    const claimed = new Set<string>();

    const claim = async (args: {
      commitmentId: string;
      scheduledFor: string;
    }) => {
      const key = followupIdempotencyKey(args.commitmentId, args.scheduledFor);
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    };
    const markSent = async () => {};

    const first = await runSweep({
      candidates: overdueOne,
      mailer,
      notifyEmail: "owner@example.com",
      now,
      claim,
      markSent,
    });
    expect(first.sent).toBe(1);
    expect(mailer.sent).toHaveLength(1);

    const second = await runSweep({
      candidates: overdueOne,
      mailer,
      notifyEmail: "owner@example.com",
      now,
      claim,
      markSent,
    });
    expect(second.sent).toBe(0);
    expect(second.skippedDuplicate).toBe(1);
    expect(mailer.sent).toHaveLength(1);
  });

  it("requires OWNER_NOTIFY_EMAIL / notifyEmail", async () => {
    await expect(
      runSweep({
        candidates: overdueOne,
        notifyEmail: "",
        now,
        claim: async () => true,
        markSent: async () => {},
      }),
    ).rejects.toThrow(/OWNER_NOTIFY_EMAIL/);
  });
});
