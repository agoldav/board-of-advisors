/**
 * Rail tree service (Pending item 4). Advisors / sections / nested chats.
 * Uses system-message markers — no schema change to 0001.
 */
import type { PoolClient } from "pg";
import { getPool, withTransaction } from "../db/pool.js";
import { listAdvisors } from "../advisors/registry.js";
import {
  parseAnchor,
  ANCHOR_PREFIX,
  type ParagraphAnchor,
} from "../conversations/anchors.js";
import {
  CannotDeleteLastConversationError,
  ConversationNotFoundError,
} from "../conversations/service.js";
import {
  parseRailMeta,
  serializeRailMeta,
  wouldCreateCycle,
  RAIL_PREFIX,
  type RailKind,
  type RailMeta,
} from "./nodes.js";

export class RailCycleError extends Error {
  constructor() {
    super("No se puede anidar un nodo dentro de sí mismo o de un hijo suyo.");
    this.name = "RailCycleError";
  }
}

export class RailValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RailValidationError";
  }
}

export type RailNode = {
  id: string;
  title: string;
  kind: RailKind;
  parentId: string | null;
  sortOrder: number;
  archived: boolean;
  advisorId: string | null;
  messageCount: number;
  createdAt: string;
  lastActivityAt: string;
  anchor: ParagraphAnchor | null;
};

type RowConv = {
  id: string;
  title: string | null;
  created_at: Date;
  last_activity_at: Date;
  message_count: string;
};

type MarkerBag = {
  rail: RailMeta | null;
  anchor: ParagraphAnchor | null;
  railMessageId: string | null;
};

const DEFAULT_ADVISOR_TITLE = "Financial Advisor";
const DEFAULT_TITLE = "Nuevo hilo";

function displayTitle(title: string | null): string {
  const t = title?.trim();
  return t ? t : DEFAULT_TITLE;
}

function defaultAdvisorPersona(): string {
  const list = listAdvisors();
  return list.find((a) => a.id === "finance")?.id ?? list[0]?.id ?? "finance";
}

async function loadConversations(ownerId: string): Promise<RowConv[]> {
  const { rows } = await getPool().query<RowConv>(
    `SELECT c.id, c.title, c.created_at,
            COALESCE(m.last_at, c.created_at) AS last_activity_at,
            COALESCE(m.message_count, 0)::text AS message_count
       FROM conversations c
       LEFT JOIN (
         SELECT conversation_id, MAX(created_at) AS last_at, COUNT(*)::int AS message_count
           FROM messages
          WHERE owner_id = $1
          GROUP BY conversation_id
       ) m ON m.conversation_id = c.id
      WHERE c.owner_id = $1
      ORDER BY c.created_at ASC`,
    [ownerId],
  );
  return rows;
}

async function loadSystemMarkers(
  ownerId: string,
): Promise<Map<string, MarkerBag>> {
  const { rows } = await getPool().query<{
    id: string;
    conversation_id: string;
    content: string;
  }>(
    `SELECT id, conversation_id, content
       FROM messages
      WHERE owner_id = $1
        AND role = 'system'
        AND (content LIKE $2 OR content LIKE $3)
      ORDER BY created_at ASC, id ASC`,
    [ownerId, `${RAIL_PREFIX}%`, `${ANCHOR_PREFIX}%`],
  );

  const map = new Map<string, MarkerBag>();
  for (const row of rows) {
    const cur = map.get(row.conversation_id) ?? {
      rail: null,
      anchor: null,
      railMessageId: null,
    };
    const rail = parseRailMeta(row.content);
    if (rail) {
      cur.rail = rail;
      cur.railMessageId = row.id;
    }
    const anchor = parseAnchor(row.content);
    if (anchor) cur.anchor = anchor;
    map.set(row.conversation_id, cur);
  }
  return map;
}

async function upsertRailMeta(
  client: PoolClient | ReturnType<typeof getPool>,
  args: {
    ownerId: string;
    conversationId: string;
    meta: RailMeta;
    existingMessageId: string | null;
  },
): Promise<void> {
  const content = serializeRailMeta(args.meta);
  if (args.existingMessageId) {
    await client.query(
      `UPDATE messages SET content = $1 WHERE id = $2 AND owner_id = $3`,
      [content, args.existingMessageId, args.ownerId],
    );
    return;
  }
  await client.query(
    `INSERT INTO messages (owner_id, conversation_id, role, content)
     VALUES ($1, $2, 'system', $3)`,
    [args.ownerId, args.conversationId, content],
  );
}

function nextSortOrder(
  siblings: Array<{ parentId: string | null; sortOrder: number; archived: boolean }>,
  parentId: string | null,
): number {
  let max = -1;
  for (const s of siblings) {
    if (s.archived) continue;
    if ((s.parentId ?? null) !== (parentId ?? null)) continue;
    if (s.sortOrder > max) max = s.sortOrder;
  }
  return max + 1;
}

function buildNodes(
  convs: RowConv[],
  markers: Map<string, MarkerBag>,
): RailNode[] {
  return convs.map((c) => {
    const m = markers.get(c.id);
    const rail = m?.rail;
    const anchor = m?.anchor ?? null;
    const parentFromAnchor = anchor?.parentConversationId ?? null;
    return {
      id: c.id,
      title: displayTitle(c.title),
      kind: rail?.kind ?? "thread",
      parentId: rail?.parentId ?? parentFromAnchor,
      sortOrder: rail?.sortOrder ?? 0,
      archived: rail?.archived ?? false,
      advisorId: rail?.advisorId ?? null,
      messageCount: Number(c.message_count),
      createdAt: c.created_at.toISOString(),
      lastActivityAt: c.last_activity_at.toISOString(),
      anchor,
    };
  });
}

function compareNodes(a: RailNode, b: RailNode): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.createdAt.localeCompare(b.createdAt);
}

async function snapshot(ownerId: string): Promise<{
  convs: RowConv[];
  markers: Map<string, MarkerBag>;
  nodes: RailNode[];
}> {
  const convs = await loadConversations(ownerId);
  const markers = await loadSystemMarkers(ownerId);
  const nodes = buildNodes(convs, markers);
  return { convs, markers, nodes };
}

/**
 * Ensure at least one top-level advisor exists and orphan chats hang under it.
 * Idempotent; may write rail markers for legacy threads.
 */
export async function ensureRailTree(ownerId: string): Promise<RailNode[]> {
  let { markers, nodes } = await snapshot(ownerId);

  const advisors = nodes.filter((n) => n.kind === "advisor" && !n.archived);
  let defaultAdvisorId =
    advisors.find((a) => a.parentId === null)?.id ?? advisors[0]?.id ?? null;

  if (!defaultAdvisorId) {
    const pool = getPool();
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO conversations (owner_id, title) VALUES ($1, $2) RETURNING id`,
      [ownerId, DEFAULT_ADVISOR_TITLE],
    );
    const id = rows[0]!.id;
    await upsertRailMeta(pool, {
      ownerId,
      conversationId: id,
      meta: {
        kind: "advisor",
        parentId: null,
        sortOrder: 0,
        archived: false,
        advisorId: defaultAdvisorPersona(),
      },
      existingMessageId: null,
    });
    defaultAdvisorId = id;
    ({ markers, nodes } = await snapshot(ownerId));
  }

  const knownIds = new Set(nodes.map((n) => n.id));
  const parentById = new Map(nodes.map((n) => [n.id, n.parentId]));
  const pool = getPool();

  for (const n of nodes) {
    if (n.archived) continue;
    if (n.kind === "advisor" || n.kind === "section") continue;

    const placed =
      n.parentId && knownIds.has(n.parentId) && n.parentId !== n.id;
    const m = markers.get(n.id);

    if (placed && m?.rail) continue;

    if (placed && n.anchor?.parentConversationId && !m?.rail) {
      await upsertRailMeta(pool, {
        ownerId,
        conversationId: n.id,
        meta: {
          kind: "thread",
          parentId: n.anchor.parentConversationId,
          sortOrder: n.sortOrder,
          archived: false,
        },
        existingMessageId: null,
      });
      continue;
    }

    if (placed) continue;

    const parentId = defaultAdvisorId;
    const meta: RailMeta = {
      kind: "thread",
      parentId,
      sortOrder: nextSortOrder(
        nodes.map((x) => ({
          parentId: x.parentId,
          sortOrder: x.sortOrder,
          archived: x.archived,
        })),
        parentId,
      ),
      archived: false,
    };
    if (
      wouldCreateCycle({
        nodeId: n.id,
        newParentId: meta.parentId,
        parentById,
      })
    ) {
      meta.parentId = null;
    }

    await upsertRailMeta(pool, {
      ownerId,
      conversationId: n.id,
      meta,
      existingMessageId: m?.railMessageId ?? null,
    });
    n.parentId = meta.parentId;
    n.sortOrder = meta.sortOrder;
    parentById.set(n.id, meta.parentId);
  }

  const final = await snapshot(ownerId);
  return final.nodes.sort(compareNodes);
}

export async function listRailNodes(ownerId: string): Promise<RailNode[]> {
  return ensureRailTree(ownerId);
}

export async function createRailNode(args: {
  ownerId: string;
  kind: "advisor" | "section" | "thread";
  title?: string;
  parentId?: string | null;
  advisorId?: string;
}): Promise<RailNode> {
  const nodes = await ensureRailTree(args.ownerId);
  const parentId = args.parentId ?? null;

  if (parentId) {
    const parent = nodes.find((n) => n.id === parentId && !n.archived);
    if (!parent) {
      throw new RailValidationError("El padre no existe o está archivado.");
    }
  }

  const title =
    args.title?.trim() ||
    (args.kind === "advisor"
      ? "New advisor"
      : args.kind === "section"
        ? "New section"
        : DEFAULT_TITLE);

  const sortOrder = nextSortOrder(
    nodes.map((n) => ({
      parentId: n.parentId,
      sortOrder: n.sortOrder,
      archived: n.archived,
    })),
    parentId,
  );

  const persona =
    args.advisorId?.trim() ||
    (args.kind === "advisor" ? defaultAdvisorPersona() : undefined);

  const id = await withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO conversations (owner_id, title) VALUES ($1, $2) RETURNING id`,
      [args.ownerId, title],
    );
    const conversationId = rows[0]!.id;
    await upsertRailMeta(client, {
      ownerId: args.ownerId,
      conversationId,
      meta: {
        kind: args.kind,
        parentId,
        sortOrder,
        archived: false,
        ...(persona ? { advisorId: persona } : {}),
      },
      existingMessageId: null,
    });
    return conversationId;
  });

  const list = await listRailNodes(args.ownerId);
  const created = list.find((n) => n.id === id);
  if (!created) throw new Error("Failed to create rail node.");
  return created;
}

export async function renameRailNode(args: {
  ownerId: string;
  nodeId: string;
  title: string;
}): Promise<RailNode> {
  const title = args.title.trim() || DEFAULT_TITLE;
  const { rows } = await getPool().query<{ id: string }>(
    `UPDATE conversations SET title = $1 WHERE id = $2 AND owner_id = $3 RETURNING id`,
    [title, args.nodeId, args.ownerId],
  );
  if (!rows[0]) throw new ConversationNotFoundError(args.nodeId);
  const list = await listRailNodes(args.ownerId);
  const node = list.find((n) => n.id === args.nodeId);
  if (!node) throw new ConversationNotFoundError(args.nodeId);
  return node;
}

export async function setRailArchived(args: {
  ownerId: string;
  nodeId: string;
  archived: boolean;
}): Promise<RailNode> {
  const { markers, nodes } = await snapshot(args.ownerId);
  // Prefer ensured tree so orphans already have markers
  const ensured = await listRailNodes(args.ownerId);
  const node = ensured.find((n) => n.id === args.nodeId) ?? nodes.find((n) => n.id === args.nodeId);
  if (!node) throw new ConversationNotFoundError(args.nodeId);

  const freshMarkers = await loadSystemMarkers(args.ownerId);
  const m = freshMarkers.get(args.nodeId) ?? markers.get(args.nodeId);
  await upsertRailMeta(getPool(), {
    ownerId: args.ownerId,
    conversationId: args.nodeId,
    meta: {
      kind: node.kind,
      parentId: node.parentId,
      sortOrder: node.sortOrder,
      archived: args.archived,
      ...(node.advisorId ? { advisorId: node.advisorId } : {}),
    },
    existingMessageId: m?.railMessageId ?? null,
  });

  const list = await listRailNodes(args.ownerId);
  const updated = list.find((n) => n.id === args.nodeId);
  if (!updated) throw new ConversationNotFoundError(args.nodeId);
  return updated;
}

export async function moveRailNode(args: {
  ownerId: string;
  nodeId: string;
  parentId: string | null;
  /** Index among non-archived siblings under the new parent (0-based). */
  index: number;
}): Promise<RailNode[]> {
  const nodes = await listRailNodes(args.ownerId);
  const node = nodes.find((n) => n.id === args.nodeId);
  if (!node) throw new ConversationNotFoundError(args.nodeId);

  if (args.parentId) {
    const parent = nodes.find((n) => n.id === args.parentId && !n.archived);
    if (!parent) {
      throw new RailValidationError("El padre no existe o está archivado.");
    }
  }

  const parentById = new Map(nodes.map((n) => [n.id, n.parentId]));
  if (
    wouldCreateCycle({
      nodeId: args.nodeId,
      newParentId: args.parentId,
      parentById,
    })
  ) {
    throw new RailCycleError();
  }

  const siblings = nodes
    .filter(
      (n) =>
        !n.archived &&
        n.id !== args.nodeId &&
        (n.parentId ?? null) === (args.parentId ?? null),
    )
    .sort(compareNodes);

  const index = Math.max(0, Math.min(args.index, siblings.length));
  const orderedIds = [
    ...siblings.slice(0, index).map((s) => s.id),
    args.nodeId,
    ...siblings.slice(index).map((s) => s.id),
  ];

  const markers = await loadSystemMarkers(args.ownerId);

  await withTransaction(async (client) => {
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i]!;
      const current = nodes.find((n) => n.id === id)!;
      const meta: RailMeta = {
        kind: current.kind,
        parentId: id === args.nodeId ? args.parentId : current.parentId,
        sortOrder: i,
        archived: false,
        ...(current.advisorId ? { advisorId: current.advisorId } : {}),
      };
      const m = markers.get(id);
      await upsertRailMeta(client, {
        ownerId: args.ownerId,
        conversationId: id,
        meta,
        existingMessageId: m?.railMessageId ?? null,
      });
    }
  });

  return listRailNodes(args.ownerId);
}

/**
 * Delete a rail node. Children are re-parented to the deleted node's parent.
 * Still refuses to delete the owner's last conversation.
 */
export async function deleteRailNode(args: {
  ownerId: string;
  nodeId: string;
}): Promise<RailNode[]> {
  const nodes = await listRailNodes(args.ownerId);
  const node = nodes.find((n) => n.id === args.nodeId);
  if (!node) throw new ConversationNotFoundError(args.nodeId);

  const markers = await loadSystemMarkers(args.ownerId);
  const children = nodes.filter((n) => n.parentId === args.nodeId);

  await withTransaction(async (client) => {
    const { rows: owned } = await client.query<{ id: string }>(
      `SELECT id FROM conversations WHERE owner_id = $1 FOR UPDATE`,
      [args.ownerId],
    );
    if (!owned.some((r) => r.id === args.nodeId)) {
      throw new ConversationNotFoundError(args.nodeId);
    }
    if (owned.length <= 1) {
      throw new CannotDeleteLastConversationError();
    }

    for (const child of children) {
      const meta: RailMeta = {
        kind: child.kind,
        parentId: node.parentId,
        sortOrder: child.sortOrder,
        archived: child.archived,
        ...(child.advisorId ? { advisorId: child.advisorId } : {}),
      };
      const m = markers.get(child.id);
      await upsertRailMeta(client, {
        ownerId: args.ownerId,
        conversationId: child.id,
        meta,
        existingMessageId: m?.railMessageId ?? null,
      });
    }

    await client.query(
      `DELETE FROM conversations WHERE id = $1 AND owner_id = $2`,
      [args.nodeId, args.ownerId],
    );
  });

  return listRailNodes(args.ownerId);
}
