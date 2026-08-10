/**
 * Document ingestion types (D-028 / D-037).
 * Mirrors documents / extracted_figures in the schema.
 */
import type { StatementSection } from "../advisors/sections.js";
import type { Figure } from "../advisors/reconciliation.js";

export type DocumentKind =
  | "financial_statement"
  | "contract"
  | "chat_export"
  | "other";

export type DocumentStatus = "uploaded" | "extracted" | "confirmed" | "rejected";

export interface ExtractedFigureRow extends Figure {
  id?: string;
  confirmedByOwner: boolean;
  correctedByOwner: boolean;
}

export interface ArithmeticValidation {
  identity: {
    balances: boolean;
    assets: number;
    liabilities: number;
    equity: number;
    difference: number;
  };
  /** Named "total" rows that do not match the sum of their section. */
  subtotalMismatches: Array<{
    lineItem: string;
    statementSection: StatementSection;
    declared: number;
    summed: number;
    difference: number;
  }>;
  /** True when identity balances and no subtotal mismatches. */
  ok: boolean;
}

export interface ConfirmationView {
  documentId: string;
  status: DocumentStatus;
  periodStart: string | null;
  periodEnd: string | null;
  figures: ExtractedFigureRow[];
  validation: ArithmeticValidation;
  /** Advice may only proceed when status=confirmed AND validation.ok. */
  readyForAdvice: boolean;
}
