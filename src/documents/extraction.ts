/**
 * PDF → structured line items via Claude document block + forced tool (D-028, D-037).
 * Every line item on the first pass — not just totals.
 */
import type { Tool } from "@anthropic-ai/sdk/resources/messages.js";
import type { StatementSection } from "../advisors/sections.js";
import type { Figure } from "../advisors/reconciliation.js";
import type { ExtractDocumentParams, ExtractDocumentResult, LlmProvider } from "../llm/client.js";
import { routeModel } from "../llm/router.js";

export const EXTRACT_TOOL_NAME = "submit_extracted_figures";

export const EXTRACT_PROMPT =
  "Extract EVERY line item from this financial statement PDF (balance sheet and/or " +
  "income statement). Include every row, not just totals. Values as numbers " +
  "(negative if shown in parentheses or with a minus). Map each row to " +
  "statement_section: assets | liabilities | equity | revenue | expense. " +
  "If this is not a financial statement, set is_financial_statement to false and " +
  "return an empty figures array. Also return period_start and period_end as " +
  "YYYY-MM-DD when visible, else null.";

export const EXTRACT_TOOL_SCHEMA: Tool.InputSchema = {
  type: "object",
  properties: {
    is_financial_statement: {
      type: "boolean",
      description: "False when the PDF is not a financial statement.",
    },
    period_start: {
      type: "string",
      description: "Period start YYYY-MM-DD. Omit or empty if unknown.",
    },
    period_end: {
      type: "string",
      description: "Period end YYYY-MM-DD. Omit or empty if unknown.",
    },
    figures: {
      type: "array",
      description: "Every line item from the statement.",
      items: {
        type: "object",
        properties: {
          line_item: { type: "string" },
          value: { type: "number" },
          statement_section: {
            type: "string",
            enum: ["assets", "liabilities", "equity", "revenue", "expense"],
          },
        },
        required: ["line_item", "value", "statement_section"],
        additionalProperties: false,
      },
    },
  },
  required: ["is_financial_statement", "figures"],
  additionalProperties: false,
};

const SECTIONS = new Set<StatementSection>([
  "assets",
  "liabilities",
  "equity",
  "revenue",
  "expense",
]);

export interface ParsedExtraction {
  isFinancialStatement: boolean;
  periodStart: string | null;
  periodEnd: string | null;
  figures: Figure[];
}

export class NotFinancialStatementError extends Error {
  constructor() {
    super(
      "El archivo no parece un estado financiero. Subí un balance o estado de resultados.",
    );
    this.name = "NotFinancialStatementError";
  }
}

export class EmptyExtractionError extends Error {
  constructor() {
    super("No se extrajo ningún renglón del PDF. Revisá el archivo e intentá de nuevo.");
    this.name = "EmptyExtractionError";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("Extraction tool input was not an object.");
}

/** Pure parser for the forced tool payload — unit-tested without the API. */
export function parseExtractionToolInput(raw: unknown): ParsedExtraction {
  const obj = asRecord(raw);
  const isFinancialStatement = Boolean(obj.is_financial_statement);
  const periodStart =
    typeof obj.period_start === "string" && obj.period_start.trim()
      ? obj.period_start.trim()
      : null;
  const periodEnd =
    typeof obj.period_end === "string" && obj.period_end.trim()
      ? obj.period_end.trim()
      : null;

  const figuresRaw = obj.figures;
  if (!Array.isArray(figuresRaw)) {
    throw new Error("Extraction tool input missing figures array.");
  }

  const figures: Figure[] = [];
  for (const row of figuresRaw) {
    const r = asRecord(row);
    const lineItem = String(r.line_item ?? "").trim();
    const value = Number(r.value);
    const section = String(r.statement_section ?? "") as StatementSection;
    if (!lineItem || Number.isNaN(value) || !SECTIONS.has(section)) {
      throw new Error(`Invalid extracted row: ${JSON.stringify(row)}`);
    }
    figures.push({ lineItem, value, statementSection: section });
  }

  return { isFinancialStatement, periodStart, periodEnd, figures };
}

export function extractionToolParams(pdfBase64: string): ExtractDocumentParams {
  const { model } = routeModel({ kind: "extraction" });
  return {
    model,
    pdfBase64,
    prompt: EXTRACT_PROMPT,
    tool: {
      name: EXTRACT_TOOL_NAME,
      description:
        "Submit every line item extracted from the financial statement PDF.",
      input_schema: EXTRACT_TOOL_SCHEMA,
    },
  };
}

/** Call the provider and return parsed figures plus usage for spend tracking. */
export async function extractFiguresFromPdf(
  provider: LlmProvider,
  pdfBytes: Buffer,
): Promise<{ parsed: ParsedExtraction; usage: ExtractDocumentResult["usage"]; model: ExtractDocumentResult["model"] }> {
  const pdfBase64 = pdfBytes.toString("base64");
  const result = await provider.extractDocument(extractionToolParams(pdfBase64));
  const parsed = parseExtractionToolInput(result.toolInput);

  if (!parsed.isFinancialStatement) {
    throw new NotFinancialStatementError();
  }
  if (parsed.figures.length === 0) {
    throw new EmptyExtractionError();
  }
  return { parsed, usage: result.usage, model: result.model };
}
