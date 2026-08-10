import { describe, it, expect } from "vitest";
import type { Figure } from "../advisors/reconciliation.js";
import {
  EmptyExtractionError,
  NotFinancialStatementError,
  parseExtractionToolInput,
} from "./extraction.js";
import {
  assertReadyForAdvice,
  UnbalancedFiguresError,
  validateFigures,
} from "./validate.js";

const balancedBs: Figure[] = [
  { lineItem: "cash", value: 100, statementSection: "assets" },
  { lineItem: "receivables", value: 50, statementSection: "assets" },
  { lineItem: "loan", value: 80, statementSection: "liabilities" },
  { lineItem: "equity", value: 70, statementSection: "equity" },
];

const unbalancedBs: Figure[] = [
  { lineItem: "cash", value: 100, statementSection: "assets" },
  { lineItem: "loan", value: 50, statementSection: "liabilities" },
  { lineItem: "equity", value: 40, statementSection: "equity" },
];

describe("validateFigures (D-028)", () => {
  it("accepts a balanced balance sheet", () => {
    const v = validateFigures(balancedBs);
    expect(v.ok).toBe(true);
    expect(v.identity.balances).toBe(true);
  });

  it("rejects a deliberately inconsistent balance sheet before advice", () => {
    const v = validateFigures(unbalancedBs);
    expect(v.ok).toBe(false);
    expect(v.identity.difference).toBe(10);
    expect(() => assertReadyForAdvice(unbalancedBs)).toThrow(UnbalancedFiguresError);
  });

  it("flags a named total that does not equal its section sum", () => {
    const figs: Figure[] = [
      { lineItem: "cash", value: 40, statementSection: "assets" },
      { lineItem: "inventory", value: 60, statementSection: "assets" },
      { lineItem: "total assets", value: 90, statementSection: "assets" },
      { lineItem: "loan", value: 100, statementSection: "liabilities" },
      { lineItem: "equity", value: 0, statementSection: "equity" },
    ];
    const v = validateFigures(figs);
    expect(v.ok).toBe(false);
    expect(v.subtotalMismatches.length).toBe(1);
    expect(v.subtotalMismatches[0]?.declared).toBe(90);
    expect(v.subtotalMismatches[0]?.summed).toBe(100);
  });

  it("allows income-statement-only sets without balance-sheet identity", () => {
    const pl: Figure[] = [
      { lineItem: "sales", value: 100, statementSection: "revenue" },
      { lineItem: "cogs", value: 60, statementSection: "expense" },
    ];
    expect(validateFigures(pl).ok).toBe(true);
  });
});

describe("parseExtractionToolInput", () => {
  it("parses every line item from the forced tool payload", () => {
    const parsed = parseExtractionToolInput({
      is_financial_statement: true,
      period_start: "2025-01-01",
      period_end: "2025-12-31",
      figures: [
        { line_item: "Cash", value: 3000, statement_section: "assets" },
        { line_item: "AP", value: 1000, statement_section: "liabilities" },
        { line_item: "Equity", value: 2000, statement_section: "equity" },
      ],
    });
    expect(parsed.isFinancialStatement).toBe(true);
    expect(parsed.periodStart).toBe("2025-01-01");
    expect(parsed.figures).toHaveLength(3);
    expect(parsed.figures[0]).toEqual({
      lineItem: "Cash",
      value: 3000,
      statementSection: "assets",
    });
  });

  it("treats empty period strings as null", () => {
    const parsed = parseExtractionToolInput({
      is_financial_statement: true,
      period_start: "",
      figures: [{ line_item: "sales", value: 1, statement_section: "revenue" }],
    });
    expect(parsed.periodStart).toBeNull();
    expect(parsed.periodEnd).toBeNull();
  });

  it("rejects invalid rows", () => {
    expect(() =>
      parseExtractionToolInput({
        is_financial_statement: true,
        figures: [{ line_item: "x", value: "nope", statement_section: "assets" }],
      }),
    ).toThrow(/Invalid extracted row/);
  });
});

describe("extraction error classes", () => {
  it("exposes clear Spanish messages for non-financial / empty PDFs", () => {
    expect(new NotFinancialStatementError().message).toMatch(/estado financiero/i);
    expect(new EmptyExtractionError().message).toMatch(/renglón/i);
  });
});
