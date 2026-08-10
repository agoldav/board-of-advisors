/**
 * Per-app spend counter (D-032 / T13).
 *
 * Cost VISIBILITY, not protection. The app never hard-stops on budget — the
 * owner shares Anthropic credits with other apps, so a per-app cutoff cannot
 * fire before a shared balance hits zero. Real protection is auto-reload in
 * the Anthropic console + a dedicated API key.
 *
 * Spend is derived from llm_operations.usage already persisted on every call
 * (no new table). Warning threshold: 90% of MONTHLY_BUDGET_USD.
 */
import { getPool } from "../db/pool.js";
import {
  costFromUsage,
  type ModelId,
  type Usage,
} from "../config/models.js";

export interface SpendSnapshot {
  spentUsd: number;
  budgetUsd: number;
  ratio: number;
  /** True at or above 90% of budget. */
  warn: boolean;
  /** True at or above 100% — still no hard stop; just a stronger signal. */
  exhausted: boolean;
}

/** Pure: decide warn / exhausted from dollars. */
export function evaluateSpend(
  spentUsd: number,
  budgetUsd: number,
): SpendSnapshot {
  const budget = budgetUsd > 0 ? budgetUsd : 0;
  const ratio = budget === 0 ? 0 : spentUsd / budget;
  return {
    spentUsd,
    budgetUsd: budget,
    ratio,
    warn: budget > 0 && ratio >= 0.9,
    exhausted: budget > 0 && ratio >= 1,
  };
}

export function budgetFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.MONTHLY_BUDGET_USD ?? "30";
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

const MODEL_IDS = new Set<ModelId>([
  "claude-haiku-4-5",
  "claude-sonnet-5",
  "claude-opus-5",
]);

function asModelId(raw: string | null): ModelId | null {
  if (!raw) return null;
  return MODEL_IDS.has(raw as ModelId) ? (raw as ModelId) : null;
}

function asUsage(raw: unknown): Usage | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const u = raw as Record<string, unknown>;
  const input = Number(u.input_tokens);
  const output = Number(u.output_tokens);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null;
  return {
    input_tokens: input,
    output_tokens: output,
    cache_read_input_tokens: Number(u.cache_read_input_tokens ?? 0) || 0,
    cache_creation_input_tokens: Number(u.cache_creation_input_tokens ?? 0) || 0,
  };
}

/** Sum dollar cost of completed operations in the current calendar month (UTC). */
export async function getMonthlySpend(ownerId: string): Promise<SpendSnapshot> {
  const budgetUsd = budgetFromEnv();
  const pool = getPool();
  const { rows } = await pool.query<{ model_used: string | null; usage: unknown }>(
    `SELECT model_used, usage
       FROM llm_operations
      WHERE owner_id = $1
        AND status = 'completed'
        AND usage IS NOT NULL
        AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC')`,
    [ownerId],
  );

  let spentUsd = 0;
  for (const row of rows) {
    const model = asModelId(row.model_used);
    const usage = asUsage(row.usage);
    if (!model || !usage) continue;
    spentUsd += costFromUsage(model, usage);
  }

  return evaluateSpend(spentUsd, budgetUsd);
}

/** Cost of a single call — used by tests and for incremental checks. */
export function costOfCall(model: ModelId, usage: Usage): number {
  return costFromUsage(model, usage);
}

/**
 * Human-readable warning for the owner. Empty string when under 90%.
 * Never blocks — visibility only.
 */
export function spendWarningMessage(snap: SpendSnapshot): string {
  if (snap.exhausted) {
    return (
      `Gastaste $${snap.spentUsd.toFixed(2)} de $${snap.budgetUsd.toFixed(2)} ` +
      `este mes (100%+). La app no se detiene; revisá el saldo en Anthropic.`
    );
  }
  if (snap.warn) {
    return (
      `Vas por $${snap.spentUsd.toFixed(2)} de $${snap.budgetUsd.toFixed(2)} ` +
      `este mes (≥90%). Aviso solamente — no hay freno automático.`
    );
  }
  return "";
}
