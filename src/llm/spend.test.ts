import { describe, it, expect } from "vitest";
import { costFromUsage } from "../config/models.js";
import {
  budgetFromEnv,
  costOfCall,
  evaluateSpend,
  spendWarningMessage,
} from "./spend.js";

describe("evaluateSpend (D-032 / T13)", () => {
  it("warns at 90% and marks exhausted at 100%, without implying a hard stop", () => {
    expect(evaluateSpend(26.9, 30).warn).toBe(false);
    expect(evaluateSpend(27, 30).warn).toBe(true);
    expect(evaluateSpend(27, 30).exhausted).toBe(false);
    expect(evaluateSpend(30, 30).exhausted).toBe(true);
    expect(evaluateSpend(35, 30).exhausted).toBe(true);
  });

  it("treats zero/invalid budget as no warning", () => {
    expect(evaluateSpend(100, 0).warn).toBe(false);
  });
});

describe("spendWarningMessage", () => {
  it("is empty under 90%", () => {
    expect(spendWarningMessage(evaluateSpend(10, 30))).toBe("");
  });
  it("mentions 90% and no hard stop", () => {
    const msg = spendWarningMessage(evaluateSpend(27, 30));
    expect(msg).toMatch(/90%/);
    expect(msg.toLowerCase()).toMatch(/aviso|no hay freno/);
  });
});

describe("cost accumulation matches usage sum", () => {
  it("sums costFromUsage across responses", () => {
    const calls = [
      {
        model: "claude-haiku-4-5" as const,
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      },
      {
        model: "claude-sonnet-5" as const,
        usage: {
          input_tokens: 2000,
          output_tokens: 1000,
          cache_read_input_tokens: 500,
          cache_creation_input_tokens: 0,
        },
      },
    ];
    const total = calls.reduce((acc, c) => acc + costOfCall(c.model, c.usage), 0);
    const expected = calls.reduce((acc, c) => acc + costFromUsage(c.model, c.usage), 0);
    expect(total).toBeCloseTo(expected);
    expect(total).toBeGreaterThan(0);
  });
});

describe("budgetFromEnv", () => {
  it("defaults to 30", () => {
    expect(budgetFromEnv({})).toBe(30);
  });
  it("reads MONTHLY_BUDGET_USD", () => {
    expect(budgetFromEnv({ MONTHLY_BUDGET_USD: "15" })).toBe(15);
  });
});
