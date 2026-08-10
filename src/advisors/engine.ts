/**
 * Advice engine (Task 3).
 *
 * Two entry points:
 *   - askAdvisor:  1:1 chat with one advisor at a time.
 *   - firstReading: the streamed cash-reconciliation first read (D-021, D-038).
 *
 * Both honor the non-negotiables:
 *   - persist input_state and COMMIT it BEFORE the model call (D-029)
 *   - route the model by task tier (D-006/D-009)
 *   - send the cached, byte-stable prefix + small advisor delta (D-008/D-034)
 *   - on success, save the recommendation with the full traceability set (D-035)
 *   - surface refusals and credit exhaustion instead of failing silently
 */
import Anthropic from "@anthropic-ai/sdk";
import { withTransaction } from "../db/pool.js";
import { createProvider, type LlmProvider } from "../llm/client.js";
import { routeModel } from "../llm/router.js";
import { getActivePrefix } from "../profile/service.js";
import { getAdvisor, renderAdvisorInstructions } from "./registry.js";
import {
  buildFirstReadFacts,
  renderFirstReadFacts,
  type Figure,
} from "./reconciliation.js";
import {
  completeOperation,
  saveMessage,
  saveRecommendation,
  startOperation,
} from "./persistence.js";
import { assertReadyForAdvice } from "../documents/validate.js";

/** Friendly, resumable error for the "out of credits" path. */
export class OutOfCreditsError extends Error {
  constructor(readonly operationId: string) {
    super(
      "Se acabaron los créditos de tu cuenta de Anthropic. Recargá y reintentá; " +
        "no se perdió nada, la operación se reanuda desde donde quedó.",
    );
    this.name = "OutOfCreditsError";
  }
}

function isCreditError(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 0;
    const msg = (err.message ?? "").toLowerCase();
    return (
      status === 402 ||
      ((status === 400 || status === 429) &&
        /credit|billing|insufficient|balance|quota/.test(msg))
    );
  }
  return false;
}

export interface EngineDeps {
  provider?: LlmProvider;
}

async function requirePrefix(ownerId: string, profileId: string): Promise<string> {
  const active = await getActivePrefix(ownerId, profileId);
  if (!active) {
    throw new Error(
      `No active profile version for profile ${profileId}. Mint one first (D-031).`,
    );
  }
  return active.renderedPrefix;
}

export interface AskAdvisorArgs {
  ownerId: string;
  profileId: string;
  conversationId: string;
  advisorId: string;
  question: string;
  /** The figures the advisor is reasoning about, captured for traceability (D-035). */
  dataSnapshot: unknown;
  /** When true, persist the answer as a recommendation. Default true. */
  saveAsRecommendation?: boolean;
}

export interface AskAdvisorResult {
  operationId: string;
  answer: string;
  model: string;
  userMessageId: string;
  assistantMessageId: string;
  recommendationId?: string;
}

export async function askAdvisor(
  args: AskAdvisorArgs,
  deps: EngineDeps = {},
): Promise<AskAdvisorResult> {
  const provider = deps.provider ?? createProvider();
  const advisor = getAdvisor(args.advisorId);
  const { model } = routeModel({ kind: "chat", text: args.question });
  const cachedPrefix = await requirePrefix(args.ownerId, args.profileId);
  const advisorInstructions = renderAdvisorInstructions(advisor);

  // D-029: persist and commit BEFORE the call.
  const operationId = await startOperation({
    ownerId: args.ownerId,
    kind: "chat",
    model,
    inputState: {
      advisorId: advisor.id,
      advisorConfigVersion: advisor.version,
      conversationId: args.conversationId,
      question: args.question,
      dataSnapshot: args.dataSnapshot,
      model,
    },
  });

  let result;
  try {
    result = await provider.generate({
      model,
      cachedPrefix,
      advisorInstructions,
      messages: [{ role: "user", content: args.question }],
    });
  } catch (err) {
    if (isCreditError(err)) {
      await completeOperation({ ownerId: args.ownerId, operationId, status: "failed_credits" });
      throw new OutOfCreditsError(operationId);
    }
    await completeOperation({ ownerId: args.ownerId, operationId, status: "failed_other" });
    throw err;
  }

  const persisted = await withTransaction(async (client) => {
    const userMessageId = await saveMessage(client, {
      ownerId: args.ownerId,
      conversationId: args.conversationId,
      role: "user",
      content: args.question,
    });
    const assistantMessageId = await saveMessage(client, {
      ownerId: args.ownerId,
      conversationId: args.conversationId,
      role: "assistant",
      content: result.text,
      advisorId: advisor.id,
      modelUsed: result.model,
      usage: result.usage,
    });

    let recommendationId: string | undefined;
    if (args.saveAsRecommendation ?? true) {
      recommendationId = await saveRecommendation(client, {
        ownerId: args.ownerId,
        text: result.text,
        advisorId: advisor.id,
        sourceMessageId: assistantMessageId,
        sourceDataSnapshot: args.dataSnapshot,
        advisorConfigVersion: advisor.version,
        modelUsed: result.model,
      });
    }
    return { userMessageId, assistantMessageId, recommendationId };
  });

  await completeOperation({
    ownerId: args.ownerId,
    operationId,
    status: "completed",
    usage: result.usage,
    model: result.model,
  });

  return {
    operationId,
    answer: result.text,
    model: result.model,
    userMessageId: persisted.userMessageId,
    assistantMessageId: persisted.assistantMessageId,
    ...(persisted.recommendationId ? { recommendationId: persisted.recommendationId } : {}),
  };
}

export interface FirstReadingArgs {
  ownerId: string;
  profileId: string;
  conversationId: string;
  /** Two periods of CONFIRMED figures (D-037). */
  previousFigures: Figure[];
  currentFigures: Figure[];
  receivablesLabel?: string;
  cashLabel?: string;
  /** Streamed output callback (D-038): show text as it generates, no spinner. */
  onDelta: (chunk: string) => void;
}

export interface FirstReadingResult {
  operationId: string;
  reading: string;
  model: string;
  recommendationId: string;
}

/**
 * The first read: a cash reconciliation, not a summary (D-021). Facts are
 * computed deterministically from confirmed figures and handed to Opus, which
 * interprets them in real numbers while streaming to the screen.
 *
 * D-028: refuses unbalanced / unconfirmed-grade figures before any model call.
 */
export async function firstReading(
  args: FirstReadingArgs,
  deps: EngineDeps = {},
): Promise<FirstReadingResult> {
  // No advice from figures that do not reconcile (D-028).
  assertReadyForAdvice(args.currentFigures);
  if (args.previousFigures.length > 0) {
    assertReadyForAdvice(args.previousFigures);
  }

  const provider = deps.provider ?? createProvider();
  const advisor = getAdvisor("finance");
  const { model } = routeModel({ kind: "first_read" }); // -> Opus (D-021)
  const cachedPrefix = await requirePrefix(args.ownerId, args.profileId);

  const facts = buildFirstReadFacts(args.previousFigures, args.currentFigures, {
    ...(args.receivablesLabel ? { receivablesLabel: args.receivablesLabel } : {}),
    ...(args.cashLabel ? { cashLabel: args.cashLabel } : {}),
  });
  const factsBrief = renderFirstReadFacts(facts);

  const prompt =
    "Este es el primer análisis para el dueño. Hacé una reconciliación de caja, " +
    "no un resumen. Explicá con números reales dónde está la diferencia entre la " +
    "utilidad contable y la caja. Sé concreto: rubro, monto, tendencia.\n\n" +
    factsBrief;

  const dataSnapshot = {
    previousFigures: args.previousFigures,
    currentFigures: args.currentFigures,
    facts,
  };

  // D-029: persist and commit BEFORE the streamed call.
  const operationId = await startOperation({
    ownerId: args.ownerId,
    kind: "first_read",
    model,
    inputState: {
      advisorId: advisor.id,
      advisorConfigVersion: advisor.version,
      conversationId: args.conversationId,
      prompt,
      dataSnapshot,
      model,
    },
  });

  let result;
  try {
    result = await provider.stream(
      {
        model,
        cachedPrefix,
        advisorInstructions: renderAdvisorInstructions(advisor),
        messages: [{ role: "user", content: prompt }],
      },
      args.onDelta,
    );
  } catch (err) {
    if (isCreditError(err)) {
      await completeOperation({ ownerId: args.ownerId, operationId, status: "failed_credits" });
      throw new OutOfCreditsError(operationId);
    }
    await completeOperation({ ownerId: args.ownerId, operationId, status: "failed_other" });
    throw err;
  }

  const recommendationId = await withTransaction(async (client) => {
    const assistantMessageId = await saveMessage(client, {
      ownerId: args.ownerId,
      conversationId: args.conversationId,
      role: "assistant",
      content: result.text,
      advisorId: advisor.id,
      modelUsed: result.model,
      usage: result.usage,
    });
    return saveRecommendation(client, {
      ownerId: args.ownerId,
      text: result.text,
      rationale: factsBrief,
      advisorId: advisor.id,
      sourceMessageId: assistantMessageId,
      sourceDataSnapshot: dataSnapshot,
      advisorConfigVersion: advisor.version,
      modelUsed: result.model,
    });
  });

  await completeOperation({
    ownerId: args.ownerId,
    operationId,
    status: "completed",
    usage: result.usage,
    model: result.model,
  });

  return { operationId, reading: result.text, model: result.model, recommendationId };
}
