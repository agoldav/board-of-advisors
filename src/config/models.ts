/**
 * Model catalog and pricing.
 *
 * Three tiers, routed by task (D-006 / D-009): Haiku for routine work, Sonnet for
 * advisory reasoning, Opus only for the hardest judgment calls.
 *
 * `cachePromptFloorTokens` is the minimum cached-prefix size below which the model
 * silently declines to cache and bills full price with NO error (D-031 / D-008).
 * Haiku's floor (4096) is the binding one because most calls route to Haiku.
 */

export type ModelId = "claude-haiku-4-5" | "claude-sonnet-5" | "claude-opus-5";

/** USD per 1,000,000 tokens. */
export interface ModelPricing {
  /** Fresh (uncached) input tokens. */
  inputPerMTok: number;
  /** Output tokens. */
  outputPerMTok: number;
  /** Writing a new cache entry (one-time per version). */
  cacheWritePerMTok: number;
  /** Reading from cache (~10% of input — the whole point of D-008). */
  cacheReadPerMTok: number;
}

export interface ModelSpec {
  id: ModelId;
  label: string;
  /** Prompt-cache minimum prefix size in tokens (model-dependent). */
  cachePromptFloorTokens: number;
  /**
   * Pricing is approximate and MUST be verified against the Anthropic pricing
   * page before the spend numbers (D-032) are shown to the owner as authoritative.
   * Centralised here so a rate change is a one-line edit.
   */
  pricing: ModelPricing;
}

export const MODELS: Record<ModelId, ModelSpec> = {
  "claude-haiku-4-5": {
    id: "claude-haiku-4-5",
    label: "Haiku 4.5",
    cachePromptFloorTokens: 4096,
    // TODO(verify): confirm against console.anthropic.com pricing.
    pricing: {
      inputPerMTok: 1.0,
      outputPerMTok: 5.0,
      cacheWritePerMTok: 1.25,
      cacheReadPerMTok: 0.1,
    },
  },
  "claude-sonnet-5": {
    id: "claude-sonnet-5",
    label: "Sonnet 5",
    cachePromptFloorTokens: 1024,
    // TODO(verify): confirm against console.anthropic.com pricing.
    pricing: {
      inputPerMTok: 3.0,
      outputPerMTok: 15.0,
      cacheWritePerMTok: 3.75,
      cacheReadPerMTok: 0.3,
    },
  },
  "claude-opus-5": {
    id: "claude-opus-5",
    label: "Opus 5",
    cachePromptFloorTokens: 512,
    // TODO(verify): confirm against console.anthropic.com pricing.
    pricing: {
      inputPerMTok: 15.0,
      outputPerMTok: 75.0,
      cacheWritePerMTok: 18.75,
      cacheReadPerMTok: 1.5,
    },
  },
};

/**
 * The binding cache floor for the profile prefix: the largest floor among models
 * the prefix will actually be sent to. Since routine calls (the majority) go to
 * Haiku, the prefix must clear Haiku's 4096-token floor to cache anywhere it matters.
 */
export const PROFILE_PREFIX_TOKEN_FLOOR = MODELS["claude-haiku-4-5"].cachePromptFloorTokens;

/** Shape of the `usage` object Anthropic returns on every response. */
export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

/**
 * Dollar cost of a single call from its `usage` object (D-032).
 * Cost VISIBILITY, not protection — the app never hard-stops on budget.
 */
export function costFromUsage(model: ModelId, usage: Usage): number {
  const p = MODELS[model].pricing;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  // Fresh input excludes tokens billed at the cache read/write rates.
  const freshInput = Math.max(0, usage.input_tokens - cacheRead - cacheWrite);
  const perMTok = (tokens: number, rate: number) => (tokens / 1_000_000) * rate;
  return (
    perMTok(freshInput, p.inputPerMTok) +
    perMTok(cacheRead, p.cacheReadPerMTok) +
    perMTok(cacheWrite, p.cacheWritePerMTok) +
    perMTok(usage.output_tokens, p.outputPerMTok)
  );
}
