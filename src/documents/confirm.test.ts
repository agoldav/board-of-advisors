/**
 * Confirmation gate tests without a live database: mirrors confirmDocument's
 * rule that unbalanced figures cannot become advice-ready (D-028 / T4 verify).
 */
import { describe, it, expect } from "vitest";
import type { Figure } from "../advisors/reconciliation.js";
import { assertReadyForAdvice, UnbalancedFiguresError, validateFigures } from "./validate.js";

function readyForAdvice(status: "uploaded" | "extracted" | "confirmed" | "rejected", figures: Figure[]) {
  const validation = validateFigures(figures);
  return status === "confirmed" && validation.ok;
}

describe("confirmation gate (T4)", () => {
  const balanced: Figure[] = [
    { lineItem: "cash", value: 100, statementSection: "assets" },
    { lineItem: "debt", value: 40, statementSection: "liabilities" },
    { lineItem: "equity", value: 60, statementSection: "equity" },
  ];
  const broken: Figure[] = [
    { lineItem: "cash", value: 100, statementSection: "assets" },
    { lineItem: "debt", value: 40, statementSection: "liabilities" },
    { lineItem: "equity", value: 50, statementSection: "equity" },
  ];

  it("extracted+balanced is not yet ready for advice until confirmed", () => {
    expect(readyForAdvice("extracted", balanced)).toBe(false);
  });

  it("confirmed+balanced is ready for advice", () => {
    expect(readyForAdvice("confirmed", balanced)).toBe(true);
  });

  it("confirmed+unbalanced is never ready for advice", () => {
    expect(readyForAdvice("confirmed", broken)).toBe(false);
    expect(() => assertReadyForAdvice(broken)).toThrow(UnbalancedFiguresError);
  });

  it("rejected documents are never ready for advice", () => {
    expect(readyForAdvice("rejected", balanced)).toBe(false);
  });
});
