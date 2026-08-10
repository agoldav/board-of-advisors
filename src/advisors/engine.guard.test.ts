import { describe, it, expect, vi } from "vitest";
import type { Figure } from "./reconciliation.js";
import { UnbalancedFiguresError } from "../documents/validate.js";

// firstReading imports DB + Anthropic; stub the heavy deps so the D-028 gate
// can be asserted without a live database or API key.
vi.mock("../db/pool.js", () => ({
  withTransaction: vi.fn(),
  getPool: vi.fn(),
}));
vi.mock("../profile/service.js", () => ({
  getActivePrefix: vi.fn(),
}));
vi.mock("../llm/client.js", () => ({
  createProvider: vi.fn(),
}));
vi.mock("./persistence.js", () => ({
  startOperation: vi.fn(),
  completeOperation: vi.fn(),
  saveMessage: vi.fn(),
  saveRecommendation: vi.fn(),
}));

import { firstReading } from "./engine.js";

describe("firstReading D-028 guard", () => {
  it("refuses unbalanced figures before any model call", async () => {
    const broken: Figure[] = [
      { lineItem: "cash", value: 100, statementSection: "assets" },
      { lineItem: "loan", value: 10, statementSection: "liabilities" },
      { lineItem: "equity", value: 10, statementSection: "equity" },
    ];
    await expect(
      firstReading({
        ownerId: "o",
        profileId: "p",
        conversationId: "c",
        previousFigures: [],
        currentFigures: broken,
        onDelta: () => {},
      }),
    ).rejects.toBeInstanceOf(UnbalancedFiguresError);
  });
});
