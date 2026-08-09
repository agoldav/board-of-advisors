/**
 * Thin provider abstraction over the model API (docs/06 — "one interface;
 * provider is a config value"). Claude only for now; swapping providers is meant
 * to be editing this file, not the call sites.
 *
 * Two things this layer guarantees for the rest of the app:
 *   1. The cached prefix is sent with cache_control so cache reads engage (D-008).
 *   2. stop_reason === "refusal" is surfaced, never rendered as a blank (docs/06).
 */
import Anthropic from "@anthropic-ai/sdk";
import type { ModelId, Usage } from "../config/models.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateParams {
  model: ModelId;
  /**
   * The versioned, byte-stable business-context prefix
   * (profile_versions.rendered_prefix). Sent as a cached system block.
   */
  cachedPrefix: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

export interface GenerateResult {
  text: string;
  stopReason: string | null;
  usage: Usage;
  model: ModelId;
}

export class RefusalError extends Error {
  constructor(message = "The model refused to answer (stop_reason: refusal).") {
    super(message);
    this.name = "RefusalError";
  }
}

export interface LlmProvider {
  countTokens(model: ModelId, prefix: string, messages?: ChatMessage[]): Promise<number>;
  generate(params: GenerateParams): Promise<GenerateResult>;
  stream(
    params: GenerateParams,
    onDelta: (chunk: string) => void,
  ): Promise<GenerateResult>;
}

/** Build the cached system block. cache_control marks the stable prefix. */
function systemBlocks(cachedPrefix: string) {
  return [
    {
      type: "text" as const,
      text: cachedPrefix,
      cache_control: { type: "ephemeral" as const },
    },
  ];
}

function toUsage(raw: Anthropic.Usage): Usage {
  return {
    input_tokens: raw.input_tokens,
    output_tokens: raw.output_tokens,
    cache_read_input_tokens: raw.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: raw.cache_creation_input_tokens ?? 0,
  };
}

export class AnthropicProvider implements LlmProvider {
  private readonly client: Anthropic;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set (see .env.example).");
    }
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Measure a prefix with the real tokenizer. Used at profile-write time to
   * assert the >= 4096 floor before a version is minted (D-031).
   */
  async countTokens(
    model: ModelId,
    prefix: string,
    messages: ChatMessage[] = [{ role: "user", content: "." }],
  ): Promise<number> {
    const res = await this.client.messages.countTokens({
      model,
      system: systemBlocks(prefix),
      messages,
    });
    return res.input_tokens;
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const res = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      system: systemBlocks(params.cachedPrefix),
      messages: params.messages,
    });
    if (res.stop_reason === "refusal") throw new RefusalError();
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return { text, stopReason: res.stop_reason, usage: toUsage(res.usage), model: params.model };
  }

  /**
   * Streaming variant for the first read (D-038): output appears as it generates,
   * never a multi-minute spinner.
   */
  async stream(
    params: GenerateParams,
    onDelta: (chunk: string) => void,
  ): Promise<GenerateResult> {
    const stream = this.client.messages.stream({
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      system: systemBlocks(params.cachedPrefix),
      messages: params.messages,
    });

    stream.on("text", (delta) => onDelta(delta));

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") throw new RefusalError();
    const text = final.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return { text, stopReason: final.stop_reason, usage: toUsage(final.usage), model: params.model };
  }
}

/** Provider factory. Provider is a config value (LLM_PROVIDER). */
export function createProvider(): LlmProvider {
  const provider = process.env.LLM_PROVIDER ?? "anthropic";
  switch (provider) {
    case "anthropic":
      return new AnthropicProvider();
    default:
      throw new Error(`Unknown LLM_PROVIDER: ${provider}`);
  }
}
