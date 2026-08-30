/**
 * Ephemeral advisor chat — no messages persisted (ghost mode).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { OutOfCreditsError as EngineCreditsError } from "../advisors/engine.js";
import { runAdvisorChatTurn } from "./chatTurn.js";
import { getConversation } from "../conversations/service.js";
import { resolveAdvisorContext } from "../rail/resolveAdvisor.js";

type SendJson = (
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
) => void;

export async function tryHandleEphemeralChatRequest(args: {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  ownerFrom: (req: IncomingMessage, body?: Record<string, unknown>) => string;
  readJson: (req: IncomingMessage) => Promise<unknown>;
  sendJson: SendJson;
}): Promise<boolean> {
  const { req, res, pathname, ownerFrom, readJson, sendJson } = args;

  if (pathname !== "/api/chat/ephemeral" || req.method !== "POST") {
    return false;
  }

  try {
    const body = (await readJson(req)) as Record<string, unknown>;
    const ownerId = ownerFrom(req, body);
    const profileId = String(body.profileId ?? "");
    const conversationId = String(body.conversationId ?? "");
    const question = String(body.question ?? "").trim();
    if (!profileId || !conversationId || !question) {
      sendJson(res, 400, {
        error: "profileId, conversationId and question are required",
      });
      return true;
    }

    await getConversation(ownerId, conversationId);
    const advisorContext = await resolveAdvisorContext(ownerId, conversationId);
    if (advisorContext.needsRoleDescription) {
      sendJson(res, 409, {
        error: "Definí qué debe hacer este asesor antes de chatear.",
        code: "NEEDS_ROLE_DESCRIPTION",
        advisorContext,
      });
      return true;
    }

    const priorTurns = Array.isArray(body.priorTurns)
      ? body.priorTurns
          .filter(
            (t): t is { role: string; content: string } =>
              typeof t === "object" &&
              t !== null &&
              (t as { role?: string }).role !== undefined &&
              typeof (t as { content?: string }).content === "string",
          )
          .map((t) => ({
            role: t.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: t.content,
          }))
      : [];

    const documentId =
      typeof body.documentId === "string" ? body.documentId.trim() : "";

    const result = await runAdvisorChatTurn({
      ownerId,
      profileId,
      conversationId,
      question,
      priorTurns,
      persistMessages: false,
      ...(documentId ? { documentId } : {}),
    });

    sendJson(res, 200, {
      ok: true,
      answer: result.answer,
      model: result.model,
      advisorContext,
    });
    return true;
  } catch (err) {
    if (err instanceof EngineCreditsError) {
      sendJson(res, 402, { error: err.message, operationId: err.operationId });
      return true;
    }
    throw err;
  }
}
