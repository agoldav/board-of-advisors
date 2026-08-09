import { describe, it, expect } from "vitest";
import {
  buildFirstReadFacts,
  growth,
  renderFirstReadFacts,
  validateAccountingIdentity,
  type Figure,
} from "./reconciliation.js";

describe("growth", () => {
  it("computes period-over-period fraction", () => {
    expect(growth(100, 118)).toBeCloseTo(0.18);
    expect(growth(100, 140)).toBeCloseTo(0.4);
  });
  it("returns null when the base is zero", () => {
    expect(growth(0, 50)).toBeNull();
  });
});

describe("accounting identity (assets = liabilities + equity)", () => {
  it("balances within tolerance", () => {
    const figs: Figure[] = [
      { lineItem: "cash", value: 100, statementSection: "assets" },
      { lineItem: "loan", value: 60, statementSection: "liabilities" },
      { lineItem: "retained", value: 40, statementSection: "equity" },
    ];
    expect(validateAccountingIdentity(figs).balances).toBe(true);
  });
  it("flags a statement that does not reconcile", () => {
    const figs: Figure[] = [
      { lineItem: "cash", value: 100, statementSection: "assets" },
      { lineItem: "loan", value: 50, statementSection: "liabilities" },
      { lineItem: "retained", value: 40, statementSection: "equity" },
    ];
    const res = validateAccountingIdentity(figs);
    expect(res.balances).toBe(false);
    expect(res.difference).toBe(10);
  });
});

describe("first read facts (D-021): profit up but cash not", () => {
  const previous: Figure[] = [
    { lineItem: "sales", value: 100, statementSection: "revenue" },
    { lineItem: "costs", value: 60, statementSection: "expense" },
    { lineItem: "accounts receivable", value: 50, statementSection: "assets" },
    { lineItem: "cash", value: 20, statementSection: "assets" },
  ];
  const current: Figure[] = [
    { lineItem: "sales", value: 130, statementSection: "revenue" },
    { lineItem: "costs", value: 82.8, statementSection: "expense" }, // profit 40 -> 47.2 (+18%)
    { lineItem: "accounts receivable", value: 70, statementSection: "assets" }, // +40%
    { lineItem: "cash", value: 18, statementSection: "assets" }, // down
  ];

  it("detects the cash divergence", () => {
    const facts = buildFirstReadFacts(previous, current);
    expect(facts.profit.growth).toBeCloseTo(0.18);
    expect(facts.receivables.growth).toBeCloseTo(0.4);
    expect(facts.cashDivergence).toBe(true);
  });

  it("does not flag divergence when cash keeps pace", () => {
    const healthy: Figure[] = [
      { lineItem: "sales", value: 130, statementSection: "revenue" },
      { lineItem: "costs", value: 82.8, statementSection: "expense" },
      { lineItem: "accounts receivable", value: 52, statementSection: "assets" },
      { lineItem: "cash", value: 40, statementSection: "assets" },
    ];
    expect(buildFirstReadFacts(previous, healthy).cashDivergence).toBe(false);
  });

  it("renders a numeric brief, not generic advice", () => {
    const brief = renderFirstReadFacts(buildFirstReadFacts(previous, current));
    expect(brief).toContain("18%");
    expect(brief).toContain("40%");
    expect(brief).toContain("CASH DIVERGENCE");
  });
});
