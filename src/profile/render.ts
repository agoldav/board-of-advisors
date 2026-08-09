/**
 * Renders the business-context prefix.
 *
 * The single hard requirement: the output must be BYTE-IDENTICAL for identical
 * input (D-008). Prompt caching reads only hit when the prefix arrives unchanged
 * on every call. So this function is pure and deterministic:
 *   - object keys are emitted in sorted order (JSON key order is otherwise unstable)
 *   - no timestamps, no locale/number formatting, no randomness
 *   - the template is fixed
 *
 * It is called ONCE at profile-write time (mintVersion), never in the request path.
 * The result is stored in profile_versions.rendered_prefix and replayed verbatim.
 */

export interface ProfileContent {
  [key: string]: unknown;
}

/** Deterministic JSON: keys sorted recursively, stable spacing. */
export function stableStringify(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  const padInner = "  ".repeat(indent + 1);

  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => padInner + stableStringify(v, indent + 1));
    return "[\n" + items.join(",\n") + "\n" + pad + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    if (keys.length === 0) return "{}";
    const entries = keys.map(
      (k) => padInner + JSON.stringify(k) + ": " + stableStringify(obj[k], indent + 1),
    );
    return "{\n" + entries.join(",\n") + "\n" + pad + "}";
  }
  return JSON.stringify(value);
}

/**
 * The shared framing every advisor sees (D-034: shared context in one place,
 * per-advisor deltas live in the advisor config). Kept as a fixed constant so it
 * contributes stable bytes to the cached prefix.
 */
export const SHARED_ADVISOR_FRAMING = `# Board of Advisors — Business Context

You are one of a board of advisors for the owner of a small business. This
document is your permanent context: read it once and anchor every analysis,
recommendation and follow-up to it. Do not relearn the business each turn.

Rules for the whole board:
- Ground every claim in the figures and facts below or in confirmed financial data.
- Never invent numbers. If a figure is missing, say so and ask for it.
- Answer only within your area. If a question belongs to another advisor, hand it
  off by name instead of guessing.
- Be concrete: name the line item, the amount, the trend. Avoid generic advice.

## Business profile
`;

/**
 * Build the byte-stable prefix from profile content.
 * @param content the profiles.content JSON (loose by design)
 */
export function renderPrefix(content: ProfileContent): string {
  return SHARED_ADVISOR_FRAMING + stableStringify(content) + "\n";
}
