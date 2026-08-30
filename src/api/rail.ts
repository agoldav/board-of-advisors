/**
 * HTTP handlers for the left-rail tree (Pending item 4).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  CannotDeleteLastConversationError,
  ConversationNotFoundError,
} from "../conversations/service.js";
import {
  RailCycleError,
  RailValidationError,
  createRailNode,
  deleteRailNode,
  listRailNodes,
  moveRailNode,
  renameRailNode,
  setRailArchived,
  setRailCustomRole,
} from "../rail/service.js";

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

export async function tryHandleRailRequest(args: {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  ownerFrom: (req: IncomingMessage, body?: Record<string, unknown>) => string;
  readJson: (req: IncomingMessage) => Promise<unknown>;
  sendJson: SendJson;
}): Promise<boolean> {
  const { req, res, pathname, ownerFrom, readJson, sendJson } = args;

  try {
    if (pathname === "/api/rail" && req.method === "GET") {
      const ownerId = ownerFrom(req);
      const items = await listRailNodes(ownerId);
      sendJson(res, 200, { ok: true, items });
      return true;
    }

    if (pathname === "/api/rail/nodes" && req.method === "POST") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const ownerId = ownerFrom(req, body);
      const kind = body.kind;
      if (kind !== "advisor" && kind !== "section" && kind !== "thread") {
        sendJson(res, 400, { error: "kind must be advisor, section, or thread" });
        return true;
      }
      const parentId =
        body.parentId === null
          ? null
          : typeof body.parentId === "string" && body.parentId.trim()
            ? body.parentId.trim()
            : undefined;
      const item = await createRailNode({
        ownerId,
        kind,
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(parentId !== undefined ? { parentId } : {}),
        ...(typeof body.expertType === "string"
          ? { expertType: body.expertType }
          : typeof body.advisorId === "string"
            ? { expertType: body.advisorId }
            : {}),
      });
      sendJson(res, 201, { ok: true, item });
      return true;
    }

    {
      const m = match(pathname, "/api/rail/nodes/:id");
      if (m && req.method === "PATCH") {
        const body = (await readJson(req)) as Record<string, unknown>;
        const ownerId = ownerFrom(req, body);
        const nodeId = m.id!;

        if (typeof body.title === "string") {
          const item = await renameRailNode({
            ownerId,
            nodeId,
            title: body.title,
          });
          sendJson(res, 200, { ok: true, item });
          return true;
        }

        if (typeof body.archived === "boolean") {
          const item = await setRailArchived({
            ownerId,
            nodeId,
            archived: body.archived,
          });
          sendJson(res, 200, { ok: true, item });
          return true;
        }

        if (typeof body.customRole === "string" && body.customRole.trim()) {
          const item = await setRailCustomRole({
            ownerId,
            nodeId,
            customRole: body.customRole.trim(),
          });
          sendJson(res, 200, { ok: true, item });
          return true;
        }

        if ("parentId" in body || typeof body.index === "number") {
          const parentId =
            body.parentId === null
              ? null
              : typeof body.parentId === "string"
                ? body.parentId
                : null;
          const index =
            typeof body.index === "number" && Number.isFinite(body.index)
              ? Math.floor(body.index)
              : 0;
          const items = await moveRailNode({
            ownerId,
            nodeId,
            parentId,
            index,
          });
          sendJson(res, 200, { ok: true, items });
          return true;
        }

        sendJson(res, 400, {
          error: "Provide title, archived, customRole, or parentId/index",
        });
        return true;
      }

      if (m && req.method === "DELETE") {
        const ownerId = ownerFrom(req);
        const items = await deleteRailNode({
          ownerId,
          nodeId: m.id!,
        });
        sendJson(res, 200, { ok: true, items });
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
    if (err instanceof RailCycleError || err instanceof RailValidationError) {
      sendJson(res, 400, { error: err.message });
      return true;
    }
    throw err;
  }
}
