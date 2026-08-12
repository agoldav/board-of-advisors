/**
 * Offline LLM stand-in for the golden path when Anthropic is not configured.
 * Same LlmProvider surface as AnthropicProvider — swap via LLM_PROVIDER=mock.
 */
import type { ModelId, Usage } from "../config/models.js";
import { PROFILE_PREFIX_TOKEN_FLOOR } from "../config/models.js";
import {
  DEMO_CURRENT_FIGURES,
  DEMO_FIRST_READING,
  DEMO_PERIOD_END,
  DEMO_PERIOD_START,
} from "./demoFigures.js";
import type {
  ExtractDocumentParams,
  ExtractDocumentResult,
  GenerateParams,
  GenerateResult,
  LlmProvider,
  ChatMessage,
} from "./client.js";

const ZERO_USAGE: Usage = {
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class MockLlmProvider implements LlmProvider {
  /** Always clears the D-031 floor so minting works without Anthropic. */
  async countTokens(
    _model: ModelId,
    _prefix: string,
    _messages?: ChatMessage[],
  ): Promise<number> {
    return PROFILE_PREFIX_TOKEN_FLOOR + 512;
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    return {
      text: DEMO_FIRST_READING,
      stopReason: "end_turn",
      usage: ZERO_USAGE,
      model: params.model,
    };
  }

  async stream(
    params: GenerateParams,
    onDelta: (chunk: string) => void,
  ): Promise<GenerateResult> {
    const text = DEMO_FIRST_READING;
    const chunkSize = 48;
    for (let i = 0; i < text.length; i += chunkSize) {
      onDelta(text.slice(i, i + chunkSize));
      await sleep(8);
    }
    return {
      text,
      stopReason: "end_turn",
      usage: ZERO_USAGE,
      model: params.model,
    };
  }

  async extractDocument(
    params: ExtractDocumentParams,
  ): Promise<ExtractDocumentResult> {
    return {
      toolInput: {
        is_financial_statement: true,
        period_start: DEMO_PERIOD_START,
        period_end: DEMO_PERIOD_END,
        figures: DEMO_CURRENT_FIGURES.map((f) => ({
          line_item: f.lineItem,
          value: f.value,
          statement_section: f.statementSection,
        })),
      },
      stopReason: "tool_use",
      usage: ZERO_USAGE,
      model: params.model,
    };
  }
}
