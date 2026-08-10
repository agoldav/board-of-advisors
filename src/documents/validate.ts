/**
 * Arithmetic validation for extracted financial figures (D-028).
 * A statement that does not reconcile is surfaced — never silently used for advice.
 */
import {
  sectionTotal,
  validateAccountingIdentity,
  type Figure,
} from "../advisors/reconciliation.js";
import type { StatementSection } from "../advisors/sections.js";
import type { ArithmeticValidation } from "./types.js";

const TOTAL_HINT = /\b(total|suma|sum)\b/i;

/**
 * Find line items whose name looks like a section total and check they match
 * the sum of the other rows in that section (within tolerance).
 */
export function findSubtotalMismatches(
  figures: Figure[],
  tolerance = 0.01,
): ArithmeticValidation["subtotalMismatches"] {
  const mismatches: ArithmeticValidation["subtotalMismatches"] = [];
  const sections = new Set(figures.map((f) => f.statementSection));

  for (const section of sections) {
    const inSection = figures.filter((f) => f.statementSection === section);
    const totals = inSection.filter((f) => TOTAL_HINT.test(f.lineItem));
    if (totals.length === 0) continue;

    const nonTotals = inSection.filter((f) => !TOTAL_HINT.test(f.lineItem));
    const summed = nonTotals.reduce((acc, f) => acc + f.value, 0);

    for (const t of totals) {
      const difference = t.value - summed;
      if (Math.abs(difference) > tolerance) {
        mismatches.push({
          lineItem: t.lineItem,
          statementSection: section,
          declared: t.value,
          summed,
          difference,
        });
      }
    }
  }
  return mismatches;
}

/** Full arithmetic check before confirmation / advice. */
export function validateFigures(figures: Figure[], tolerance = 0.01): ArithmeticValidation {
  const identity = validateAccountingIdentity(figures, tolerance);
  const subtotalMismatches = findSubtotalMismatches(figures, tolerance);
  // Identity only applies when the set looks like a balance sheet (all three sides).
  // Income-statement-only extractions (revenue/expense) are validated via subtotals.
  const looksLikeBalanceSheet =
    figures.some((f) => f.statementSection === "assets") &&
    figures.some((f) => f.statementSection === "liabilities") &&
    figures.some((f) => f.statementSection === "equity");
  return {
    identity,
    subtotalMismatches,
    ok:
      (!looksLikeBalanceSheet || identity.balances) &&
      subtotalMismatches.length === 0,
  };
}

/**
 * Gate for confirmation and advice (D-028): figures must arithmetically reconcile.
 * Owner corrections run through this before status can become `confirmed`.
 */
export function assertReadyForAdvice(figures: Figure[]): void {
  const v = validateFigures(figures);
  if (!v.ok) {
    const parts: string[] = [];
    if (!v.identity.balances) {
      parts.push(
        `assets (${v.identity.assets}) ≠ liabilities+equity ` +
          `(${v.identity.liabilities + v.identity.equity}); diff ${v.identity.difference}`,
      );
    }
    for (const m of v.subtotalMismatches) {
      parts.push(
        `${m.lineItem} [${m.statementSection}]: declared ${m.declared} vs sum ${m.summed}`,
      );
    }
    throw new UnbalancedFiguresError(parts.join("; "));
  }
}

export class UnbalancedFiguresError extends Error {
  constructor(detail: string) {
    super(
      `Los números no cuadran y no se puede generar consejo hasta corregirlos: ${detail}`,
    );
    this.name = "UnbalancedFiguresError";
  }
}

/** Convenience re-export for callers that only need section totals. */
export function totalFor(figures: Figure[], section: StatementSection): number {
  return sectionTotal(figures, section);
}
