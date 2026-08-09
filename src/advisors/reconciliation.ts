/**
 * Cash reconciliation — the substance of the first read (D-021).
 *
 * The first read is NOT a summary. It shows real numbers and the gap between
 * accrual profit and actual cash: e.g. "profit grew 18% but receivables grew
 * 40%". These are PURE functions over confirmed line items (D-037) so the facts
 * are computed deterministically and handed to the model, not hallucinated.
 */
import type { StatementSection } from "./sections.js";

export interface Figure {
  lineItem: string;
  value: number;
  statementSection: StatementSection;
}

/** Sum every figure in a section. */
export function sectionTotal(figures: Figure[], section: StatementSection): number {
  return figures
    .filter((f) => f.statementSection === section)
    .reduce((acc, f) => acc + f.value, 0);
}

/** Find a single line item by (case-insensitive) name; 0 if absent. */
export function lineItem(figures: Figure[], name: string): number {
  const hit = figures.find((f) => f.lineItem.toLowerCase() === name.toLowerCase());
  return hit ? hit.value : 0;
}

/** assets = liabilities + equity, within a tolerance. Never advise if it fails. */
export function validateAccountingIdentity(
  figures: Figure[],
  tolerance = 0.01,
): { balances: boolean; assets: number; liabilities: number; equity: number; difference: number } {
  const assets = sectionTotal(figures, "assets");
  const liabilities = sectionTotal(figures, "liabilities");
  const equity = sectionTotal(figures, "equity");
  const difference = assets - (liabilities + equity);
  return {
    balances: Math.abs(difference) <= tolerance,
    assets,
    liabilities,
    equity,
    difference,
  };
}

/** Period-over-period growth as a fraction (0.18 = +18%). null if base is 0. */
export function growth(previous: number, current: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

export interface FirstReadFacts {
  profit: { previous: number; current: number; growth: number | null };
  receivables: { previous: number; current: number; growth: number | null };
  cash: { previous: number; current: number; growth: number | null };
  /** True when profit rose while cash did not keep pace — the core tension. */
  cashDivergence: boolean;
  identity: ReturnType<typeof validateAccountingIdentity>;
}

/**
 * Build the structured facts for the first read from two periods of confirmed
 * figures. Profit is revenue - expense; receivables and cash are named line items.
 */
export function buildFirstReadFacts(
  previous: Figure[],
  current: Figure[],
  opts: { receivablesLabel?: string; cashLabel?: string } = {},
): FirstReadFacts {
  const receivablesLabel = opts.receivablesLabel ?? "accounts receivable";
  const cashLabel = opts.cashLabel ?? "cash";

  const profitPrev = sectionTotal(previous, "revenue") - sectionTotal(previous, "expense");
  const profitCurr = sectionTotal(current, "revenue") - sectionTotal(current, "expense");
  const arPrev = lineItem(previous, receivablesLabel);
  const arCurr = lineItem(current, receivablesLabel);
  const cashPrev = lineItem(previous, cashLabel);
  const cashCurr = lineItem(current, cashLabel);

  const profitGrowth = growth(profitPrev, profitCurr);
  const cashGrowth = growth(cashPrev, cashCurr);

  // Divergence: profit grew but cash grew slower (or fell). This is the
  // "we made money but have no cash" signal the owner lives with.
  const cashDivergence =
    profitGrowth !== null &&
    profitGrowth > 0 &&
    (cashGrowth === null || cashGrowth < profitGrowth);

  return {
    profit: { previous: profitPrev, current: profitCurr, growth: profitGrowth },
    receivables: { previous: arPrev, current: arCurr, growth: growth(arPrev, arCurr) },
    cash: { previous: cashPrev, current: cashCurr, growth: cashGrowth },
    cashDivergence,
    identity: validateAccountingIdentity(current),
  };
}

const pct = (g: number | null): string => (g === null ? "n/a" : `${(g * 100).toFixed(0)}%`);

/**
 * Render the facts as a compact, numeric brief handed to the model so its output
 * is grounded in real figures, not generic advice.
 */
export function renderFirstReadFacts(facts: FirstReadFacts): string {
  const lines = [
    "Confirmed reconciliation facts (do not restate generically — interpret them):",
    `- Accrual profit: ${facts.profit.previous} -> ${facts.profit.current} (${pct(facts.profit.growth)})`,
    `- Accounts receivable: ${facts.receivables.previous} -> ${facts.receivables.current} (${pct(facts.receivables.growth)})`,
    `- Cash: ${facts.cash.previous} -> ${facts.cash.current} (${pct(facts.cash.growth)})`,
    `- Accounting identity balances: ${facts.identity.balances} (diff ${facts.identity.difference})`,
  ];
  if (facts.cashDivergence) {
    lines.push(
      `- CASH DIVERGENCE: profit rose ${pct(facts.profit.growth)} while cash ` +
        `moved ${pct(facts.cash.growth)} and receivables ${pct(facts.receivables.growth)}. ` +
        `Explain where the cash went, in numbers.`,
    );
  }
  return lines.join("\n");
}
