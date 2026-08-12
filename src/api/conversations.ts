/**
 * HTTP handlers for chat threads (D-039). Returns true when the request
 * was claimed so the main router can stay additive.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { askAdvisor, OutOfCreditsError as EngineCreditsError } from "../advisors/engine.js";
import {
  CannotDeleteLastConversationError,
  ConversationNotFoundError,
  createConversation,
  deleteConversation,
  exportConversation,
  getConversation,
  getOrCreateParagraphThread,
  importConversation,
  listConversations,
  maybeAutotitle,
  renameConversation,
  rewriteUserMessageContent,
} from "../conversations/service.js";
import {
  buildParagraphModelPrompt,
  parseAnchor,
} from "../conversations/anchors.js";
import { InvalidConversationExportError } from "../conversations/export.js";
import { getConfirmedFiguresForAdvice } from "../documents/service.js";

type SendJson = (
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
) => void;

function match(
  pathname: string,
  pattern: string,
): Record<string, string> | null {
  const pp = pattern.split("/").filter(Boolean);
  const ap = pathname.split("/").filter(Boolean);
  if (pp.length !== ap.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    const p = pp[i]!;
    const a = ap[i]!;
    if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(a);
    else if (p !== a) return null;
  }
  return params;
}

export async function tryHandleConversationRequest(args: {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  ownerFrom: (req: IncomingMessage, body?: Record<string, unknown>) => string;
  readJson: (req: IncomingMessage) => Promise<unknown>;
  sendJson: SendJson;
}): Promise<boolean> {
  const { req, res, pathname, ownerFrom, readJson, sendJson } = args;

  try {
    if (pathname === "/api/conversations" && req.method === "GET") {
      const ownerId = ownerFrom(req);
      const items = await listConversations(ownerId);
      sendJson(res, 200, { ok: true, items });
      return true;
    }

    if (pathname === "/api/conversations" && req.method === "POST") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const ownerId = ownerFrom(req, body);
      const item = await createConversation({
        ownerId,
        ...(typeof body.title === "string" ? { title: body.title } : {}),
      });
      sendJson(res, 201, { ok: true, item });
      return true;
    }

    if (pathname === "/api/conversations/paragraph" && req.method === "POST") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const ownerId = ownerFrom(req, body);
      const sectionKey = String(body.sectionKey ?? "").trim();
      const sectionTitle = String(body.sectionTitle ?? sectionKey).trim();
      const excerpt = String(body.excerpt ?? "").trim();
      if (!sectionKey || !excerpt) {
        sendJson(res, 400, { error: "sectionKey and excerpt are required" });
        return true;
      }
      const parentConversationId =
        typeof body.parentConversationId === "string" &&
        body.parentConversationId.trim()
          ? body.parentConversationId.trim()
          : undefined;
      const source =
        body.source === "chat" || body.source === "first_reading"
          ? body.source
          : "first_reading";
      const item = await getOrCreateParagraphThread({
        ownerId,
        anchor: {
          kind: "paragraph",
          sectionKey,
          sectionTitle: sectionTitle || sectionKey,
          excerpt,
          source,
          ...(parentConversationId ? { parentConversationId } : {}),
        },
      });
      sendJson(res, 201, { ok: true, item });
      return true;
    }

    if (pathname === "/api/conversations/import" && req.method === "POST") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const ownerId = ownerFrom(req, body);
      const payload = body.payload ?? body;
      const item = await importConversation({ ownerId, payload });
      sendJson(res, 201, { ok: true, item });
      return true;
    }

    {
      const m = match(pathname, "/api/conversations/:id/export");
      if (m && req.method === "GET") {
        const ownerId = ownerFrom(req);
        const payload = await exportConversation(ownerId, m.id!);
        sendJson(res, 200, { ok: true, payload });
        return true;
      }
    }

    {
      const m = match(pathname, "/api/conversations/:id/messages");
      if (m && req.method === "POST") {
        const body = (await readJson(req)) as Record<string, unknown>;
        const ownerId = ownerFrom(req, body);
        const profileId = String(body.profileId ?? "");
        const question = String(body.question ?? "").trim();
        const advisorId =
          typeof body.advisorId === "string" && body.advisorId.trim()
            ? body.advisorId.trim()
            : "finance";
        if (!profileId || !question) {
          sendJson(res, 400, { error: "profileId and question are required" });
          return true;
        }
        await getConversation(ownerId, m.id!);

        const detailBefore = await getConversation(ownerId, m.id!);
        const anchorMsg = detailBefore.messages.find(
          (msg) => msg.role === "system" && parseAnchor(msg.content),
        );
        const anchor = anchorMsg ? parseAnchor(anchorMsg.content) : null;
        const priorTurns = detailBefore.messages
          .filter((msg) => msg.role === "user" || msg.role === "assistant")
          .map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          }));

        let dataSnapshot: unknown = {};
        const documentId =
          typeof body.documentId === "string" ? body.documentId.trim() : "";
        if (documentId) {
          try {
            dataSnapshot = await getConfirmedFiguresForAdvice(ownerId, documentId);
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
              question,
              priorTurns,
            })
          : priorTurns.length > 0
            ? [
                ...priorTurns.map((t) =>
                  t.role === "user"
                    ? `Dueño: ${t.content}`
                    : `Asesor: ${t.content}`,
                ),
                `Dueño: ${question}`,
              ].join("\n\n")
            : question;

        const result = await askAdvisor({
          ownerId,
          profileId,
          conversationId: m.id!,
          advisorId,
          question: modelQuestion,
          dataSnapshot,
          saveAsRecommendation: false,
        });

        // Keep the stored user bubble as the short question the owner typed
        // (askAdvisor persists the full model prompt otherwise).
        if (modelQuestion !== question) {
          await rewriteUserMessageContent({
            ownerId,
            messageId: result.userMessageId,
            content: question,
          });
        }

        if (!anchor) {
          await maybeAutotitle({
            ownerId,
            conversationId: m.id!,
            question,
          });
        }
        const item = await getConversation(ownerId, m.id!);
        sendJson(res, 201, { ok: true, item, ...result });
        return true;
      }
    }

    {
      const m = match(pathname, "/api/conversations/:id");
      if (m && req.method === "GET") {
        const ownerId = ownerFrom(req);
        const item = await getConversation(ownerId, m.id!);
        sendJson(res, 200, { ok: true, item });
        return true;
      }
      if (m && req.method === "PATCH") {
        const body = (await readJson(req)) as Record<string, unknown>;
        const ownerId = ownerFrom(req, body);
        const title = String(body.title ?? "");
        const item = await renameConversation({
          ownerId,
          conversationId: m.id!,
          title,
        });
        sendJson(res, 200, { ok: true, item });
        return true;
      }
      if (m && req.method === "DELETE") {
        const ownerId = ownerFrom(req);
        await deleteConversation({ ownerId, conversationId: m.id! });
        sendJson(res, 200, { ok: true });
        return true;
      }
    }

    return false;
  } catch (err) {
    if (err instanceof ConversationNotFoundError) {
      sendJson(res, 404, { error: err.message });
      return true;
    }
    if (err instanceof CannotDeleteLastConversationError) {
      sendJson(res, 409, { error: err.message });
      return true;
    }
    if (err instanceof InvalidConversationExportError) {
      sendJson(res, 400, { error: err.message });
      return true;
    }
    if (err instanceof EngineCreditsError) {
      sendJson(res, 402, { error: err.message, operationId: err.operationId });
      return true;
    }
    throw err;
  }
}
