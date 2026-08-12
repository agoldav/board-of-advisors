/**
 * Mock provider returns a cache-floor-safe token count without Anthropic.
 */
import { describe, expect, it } from "vitest";
import { PROFILE_PREFIX_TOKEN_FLOOR } from "../config/models.js";
import { MockLlmProvider } from "./mockProvider.js";
import { DEMO_CURRENT_FIGURES } from "./demoFigures.js";
import { validateFigures } from "../documents/validate.js";

describe("MockLlmProvider", () => {
  const mock = new MockLlmProvider();

  it("countTokens clears the Haiku cache floor", async () => {
    const n = await mock.countTokens("claude-haiku-4-5", "x");
    expect(n).toBeGreaterThanOrEqual(PROFILE_PREFIX_TOKEN_FLOOR);
  });

  it("extractDocument returns balanced demo figures", async () => {
    const res = await mock.extractDocument({
      model: "claude-haiku-4-5",
      pdfBase64: "AAAA",
      prompt: "extract",
      tool: {
        name: "submit_extracted_figures",
        description: "x",
        input_schema: { type: "object", properties: {} },
      },
    });
    const input = res.toolInput as {
      is_financial_statement: boolean;
      figures: unknown[];
    };
    expect(input.is_financial_statement).toBe(true);
    expect(input.figures.length).toBe(DEMO_CURRENT_FIGURES.length);
    expect(validateFigures(DEMO_CURRENT_FIGURES).ok).toBe(true);
  });

  it("stream emits the full first reading", async () => {
    let acc = "";
    const res = await mock.stream(
      {
        model: "claude-opus-5",
        cachedPrefix: "prefix",
        messages: [{ role: "user", content: "go" }],
      },
      (chunk) => {
        acc += chunk;
      },
    );
    expect(acc).toBe(res.text);
    expect(res.text.length).toBeGreaterThan(100);
  });
});
