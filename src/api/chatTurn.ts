/**
 * Shared advisor chat turn: resolve context, build prompt, call engine.
 */
import { askAdvisor } from "../advisors/engine.js";
import { getConfirmedFiguresForAdvice } from "../documents/service.js";
import {
  buildParagraphModelPrompt,
  parseAnchor,
} from "../conversations/anchors.js";
import { getConversation, rewriteUserMessageContent } from "../conversations/service.js";
import { resolveAdvisorContext } from "../rail/resolveAdvisor.js";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function runAdvisorChatTurn(args: {
  ownerId: string;
  profileId: string;
  conversationId: string;
  question: string;
  documentId?: string;
  priorTurns?: ChatTurn[];
  persistMessages?: boolean;
}): Promise<{
  answer: string;
  model: string;
  userMessageId: string;
  assistantMessageId: string;
}> {
  const advisorContext = await resolveAdvisorContext(args.ownerId, args.conversationId);
  if (advisorContext.needsRoleDescription) {
    throw new Error("NEEDS_ROLE_DESCRIPTION");
  }

  const detailBefore = await getConversation(args.ownerId, args.conversationId);
  const anchorMsg = detailBefore.messages.find(
    (msg) => msg.role === "system" && parseAnchor(msg.content),
  );
  const anchor = anchorMsg ? parseAnchor(anchorMsg.content) : null;

  const priorTurns =
    args.priorTurns ??
    detailBefore.messages
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

  let dataSnapshot: unknown = {};
  const documentId = args.documentId?.trim() ?? "";
  if (documentId) {
    try {
      dataSnapshot = await getConfirmedFiguresForAdvice(args.ownerId, documentId);
    } catch {
      dataSnapshot = {};
    }
  }
  if (anchor) {
    dataSnapshot = {
      ...(typeof dataSnapshot === "object" && dataSnapshot
        ? (dataSnapshot as object)
        : {}),
      paragraphAnchor: anchor,
    };
  }

  const modelQuestion = anchor
    ? buildParagraphModelPrompt({
        anchor,
        question: args.question,
        priorTurns,
      })
    : priorTurns.length > 0
      ? [
          ...priorTurns.map((t) =>
            t.role === "user" ? `Dueño: ${t.content}` : `Asesor: ${t.content}`,
          ),
          `Dueño: ${args.question}`,
        ].join("\n\n")
      : args.question;

  const askArgs = {
    ownerId: args.ownerId,
    profileId: args.profileId,
    conversationId: args.conversationId,
    advisorId: advisorContext.advisorId,
    question: modelQuestion,
    dataSnapshot,
    saveAsRecommendation: false as const,
    persistMessages: args.persistMessages ?? true,
  };
  if (advisorContext.expertType === "custom") {
    Object.assign(askArgs, {
      customRole: advisorContext.customRole!,
      displayTitle: advisorContext.displayTitle,
    });
  }

  const result = await askAdvisor(askArgs);

  if ((args.persistMessages ?? true) && modelQuestion !== args.question) {
    await rewriteUserMessageContent({
      ownerId: args.ownerId,
      messageId: result.userMessageId,
      content: args.question,
    });
  }

  return {
    answer: result.answer,
    model: result.model,
    userMessageId: result.userMessageId,
    assistantMessageId: result.assistantMessageId,
  };
}
