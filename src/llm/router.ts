/**
 * Model router (D-006 / D-009).
 *
 * Routing is decided BEFORE the call, by task type — a cheap model is a poor
 * judge of its own competence, so we never ask it "can you handle this?"
 * (docs/06 Advice Engine). Classification is near-deterministic:
 *
 *   routine   -> Haiku 4.5   (extraction, chat-export parsing, classification, digests)
 *   advisory  -> Sonnet 5    (the everyday advice/reasoning tier)
 *   hard      -> Opus 5      (forensic "where's the cash", tax/legal judgment calls)
 *
 * `kind` mirrors llm_operations.kind so the persisted operation and the routed
 * model always agree.
 */
import type { ModelId } from "../config/models.js";

export type TaskTier = "routine" | "advisory" | "hard";

/** Mirrors the llm_operations.kind enum in the DB schema. */
export type OperationKind = "extraction" | "first_read" | "chat" | "classification";

export const MODEL_FOR_TIER: Record<TaskTier, ModelId> = {
  routine: "claude-haiku-4-5",
  advisory: "claude-sonnet-5",
  hard: "claude-opus-5",
};

export function modelForTier(tier: TaskTier): ModelId {
  return MODEL_FOR_TIER[tier];
}

/**
 * Signals used to classify a chat question up front. `forceTier` lets a caller
 * (or a future Haiku pre-classification call — D-009 Mechanism B) override the
 * heuristic; `escalate` bumps advisory -> hard for questions a caller already
 * knows are heavy.
 */
export interface ClassifyInput {
  kind: OperationKind;
  /** The user's question text, for the chat kind. */
  text?: string;
  forceTier?: TaskTier;
  escalate?: boolean;
}

/** Questions that need Opus regardless of the everyday-advisory default. */
const HARD_SIGNALS: RegExp[] = [
  /d[oó]nde\s+est[aá]\s+(la\s+)?plata|where('?s| is)\s+the\s+cash/i,
  /reconcil|reconstru|forense|forensic/i,
  /balance\s+(sheet|general)/i,
  // "contrato"/"contract" is intentionally excluded: in Spanish "contrato"
  // also means "I hire", a false positive. Use clause/legal signals instead.
  /\biva\b|impuesto|tax\b|legal|cl[aá]usula|clause|contractual/i,
  /qu[ié]ebra|insolven|default|restructur|reestructur/i,
];

export function classifyTier(input: ClassifyInput): TaskTier {
  if (input.forceTier) return input.forceTier;

  switch (input.kind) {
    case "extraction":
    case "classification":
      return "routine";
    // The first read is the cash-reconciliation / "where's the cash" question —
    // the hardest tier by definition (docs/06, D-021).
    case "first_read":
      return "hard";
    case "chat": {
      const text = input.text ?? "";
      if (HARD_SIGNALS.some((re) => re.test(text))) return "hard";
      return input.escalate ? "hard" : "advisory";
    }
  }
}

/** Convenience: classify and resolve to a concrete model in one step. */
export function routeModel(input: ClassifyInput): { tier: TaskTier; model: ModelId } {
  const tier = classifyTier(input);
  return { tier, model: modelForTier(tier) };
}
