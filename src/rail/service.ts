/**
 * Rail tree service (Pending item 4). Advisors / sections / nested chats.
 * Uses system-message markers — no schema change to 0001.
 */
import type { PoolClient } from "pg";
import { getPool, withTransaction } from "../db/pool.js";
import { getAdvisor, normalizeExpertId } from "../advisors/registry.js";
import {
  CUSTOM_EXPERT_TYPE,
  defaultTitleForExpertType,
  isPresetExpertType,
  PRESET_EXPERT_TYPES,
  presetTypeForTitle,
} from "../advisors/presets.js";
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
  /** Preset slug or "custom" (D-040). */
  expertType: string | null;
  customRole: string | null;
  /** @deprecated Same as expertType for preset advisors. */
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

const DEFAULT_TITLE = "Nuevo hilo";

function displayTitle(title: string | null): string {
  const t = title?.trim();
  return t ? t : DEFAULT_TITLE;
}

function nodeExpertType(rail: RailMeta | null | undefined): string | null {
  const raw = rail?.expertType ?? rail?.advisorId;
  if (!raw?.trim()) return null;
  const normalized = normalizeExpertId(raw.trim());
  if (normalized === CUSTOM_EXPERT_TYPE) return CUSTOM_EXPERT_TYPE;
  if (isPresetExpertType(normalized)) return normalized;
  try {
    getAdvisor(normalized);
    return normalized;
  } catch {
    return null;
  }
}

function toRailMeta(
  node: Pick<
    RailNode,
    "kind" | "parentId" | "sortOrder" | "archived" | "expertType" | "customRole"
  >,
): RailMeta {
  const meta: RailMeta = {
    kind: node.kind,
    parentId: node.parentId,
    sortOrder: node.sortOrder,
    archived: node.archived,
  };
  if (node.expertType) {
    meta.expertType = node.expertType;
    if (node.expertType !== CUSTOM_EXPERT_TYPE) {
      meta.advisorId = node.expertType;
    }
  }
  if (node.customRole?.trim()) meta.customRole = node.customRole.trim();
  return meta;
}

/** Pick the next unused preset expert type, else custom (D-040). */
function pickExpertTypeForNewAdvisor(nodes: RailNode[]): {
  expertType: string;
  defaultTitle: string;
} {
  const used = new Set(
    nodes
      .filter((n) => n.kind === "advisor" && !n.archived && n.expertType)
      .map((n) => n.expertType!)
      .filter((id) => isPresetExpertType(id)),
  );
  for (const preset of PRESET_EXPERT_TYPES) {
    if (!used.has(preset.id)) {
      return { expertType: preset.id, defaultTitle: preset.defaultTitle };
    }
  }
  return { expertType: CUSTOM_EXPERT_TYPE, defaultTitle: "Nuevo asesor" };
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

function presetTypeForAdvisor(advisor: RailNode): string | null {
  const raw = advisor.expertType ?? advisor.advisorId;
  if (raw) {
    const normalized = normalizeExpertId(raw);
    if (normalized === CUSTOM_EXPERT_TYPE) return null;
    if (isPresetExpertType(normalized)) return normalized;
  }
  return presetTypeForTitle(advisor.title);
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
      expertType: nodeExpertType(rail),
      customRole: rail?.customRole?.trim() || null,
      advisorId: nodeExpertType(rail),
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

/** Backfill expertType and archive duplicate preset cards (D-040). */
async function reconcilePresetAdvisors(
  ownerId: string,
  nodes: RailNode[],
): Promise<void> {
  const markers = await loadSystemMarkers(ownerId);
  const advisors = nodes.filter((n) => n.kind === "advisor" && !n.archived);
  const pool = getPool();

  for (const advisor of advisors) {
    if (advisor.expertType && advisor.expertType !== CUSTOM_EXPERT_TYPE) continue;
    const inferred = presetTypeForTitle(advisor.title);
    if (!inferred) continue;
    const m = markers.get(advisor.id);
    await upsertRailMeta(pool, {
      ownerId,
      conversationId: advisor.id,
      meta: toRailMeta({
        kind: advisor.kind,
        parentId: advisor.parentId,
        sortOrder: advisor.sortOrder,
        archived: advisor.archived,
        expertType: inferred,
        customRole: advisor.customRole,
      }),
      existingMessageId: m?.railMessageId ?? null,
    });
    advisor.expertType = inferred;
    advisor.advisorId = inferred;
  }

  const byType = new Map<string, RailNode[]>();
  for (const advisor of advisors) {
    const type = presetTypeForAdvisor(advisor);
    if (!type) continue;
    const group = byType.get(type) ?? [];
    group.push(advisor);
    byType.set(type, group);
  }

  for (const group of byType.values()) {
    if (group.length <= 1) continue;
    group.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt),
    );
    const keeper = group[0]!;
    for (const dup of group.slice(1)) {
      const children = nodes.filter((n) => n.parentId === dup.id && !n.archived);
      for (const child of children) {
        const cm = markers.get(child.id);
        await upsertRailMeta(pool, {
          ownerId,
          conversationId: child.id,
          meta: toRailMeta({
            kind: child.kind,
            parentId: keeper.id,
            sortOrder: child.sortOrder,
            archived: false,
            expertType: child.expertType,
            customRole: child.customRole,
          }),
          existingMessageId: cm?.railMessageId ?? null,
        });
      }
      const dm = markers.get(dup.id);
      await upsertRailMeta(pool, {
        ownerId,
        conversationId: dup.id,
        meta: toRailMeta({
          kind: dup.kind,
          parentId: dup.parentId,
          sortOrder: dup.sortOrder,
          archived: true,
          expertType: dup.expertType,
          customRole: dup.customRole,
        }),
        existingMessageId: dm?.railMessageId ?? null,
      });
    }
  }
}

/** Seed the seven preset expert cards on the rail when any are missing (D-040). */
async function ensurePresetAdvisorCards(
  ownerId: string,
  nodes: RailNode[],
): Promise<void> {
  const advisors = nodes.filter((n) => n.kind === "advisor" && !n.archived);
  const usedTypes = new Set<string>();
  for (const advisor of advisors) {
    const type = presetTypeForAdvisor(advisor);
    if (type) usedTypes.add(type);
  }

  const missing = PRESET_EXPERT_TYPES.filter((p) => !usedTypes.has(p.id));
  if (missing.length === 0) return;

  let sortOrder = 0;
  for (const advisor of advisors) {
    if ((advisor.parentId ?? null) !== null) continue;
    sortOrder = Math.max(sortOrder, advisor.sortOrder + 1);
  }

  const pool = getPool();
  for (const preset of missing) {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO conversations (owner_id, title) VALUES ($1, $2) RETURNING id`,
      [ownerId, preset.defaultTitle],
    );
    const id = rows[0]!.id;
    await upsertRailMeta(pool, {
      ownerId,
      conversationId: id,
      meta: {
        kind: "advisor",
        parentId: null,
        sortOrder,
        archived: false,
        expertType: preset.id,
        advisorId: preset.id,
      },
      existingMessageId: null,
    });
    sortOrder += 1;
  }
}

async function syncPresetAdvisors(ownerId: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `boa-rail-seed:${ownerId}`,
    ]);
    let { nodes } = await snapshot(ownerId);
    await reconcilePresetAdvisors(ownerId, nodes);
    ({ nodes } = await snapshot(ownerId));
    await ensurePresetAdvisorCards(ownerId, nodes);
  });
}

/**
 * Ensure at least one top-level advisor exists and orphan chats hang under it.
 * Idempotent; may write rail markers for legacy threads.
 */
export async function ensureRailTree(ownerId: string): Promise<RailNode[]> {
  await syncPresetAdvisors(ownerId);
  let { markers, nodes } = await snapshot(ownerId);

  const advisors = nodes.filter((n) => n.kind === "advisor" && !n.archived);
  const defaultAdvisorId =
    advisors.find((a) => a.parentId === null)?.id ?? advisors[0]?.id ?? null;

  if (!defaultAdvisorId) {
    throw new Error("Rail tree has no advisors after preset seed.");
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

async function readRailNodes(ownerId: string): Promise<RailNode[]> {
  const { nodes } = await snapshot(ownerId);
  return nodes.sort(compareNodes);
}

export async function listRailNodes(ownerId: string): Promise<RailNode[]> {
  return ensureRailTree(ownerId);
}

export async function createRailNode(args: {
  ownerId: string;
  kind: "advisor" | "section" | "thread";
  title?: string;
  parentId?: string | null;
  expertType?: string;
}): Promise<RailNode> {
  const parentId = args.parentId ?? null;

  if (parentId) {
    const { rows } = await getPool().query<{ id: string }>(
      `SELECT id FROM conversations WHERE id = $1 AND owner_id = $2`,
      [parentId, args.ownerId],
    );
    if (!rows[0]) {
      throw new RailValidationError("El padre no existe o está archivado.");
    }
  }

  const nodes = await readRailNodes(args.ownerId);

  let expertType: string | null = null;
  let title = args.title?.trim();
  if (args.kind === "advisor") {
    if (args.expertType?.trim()) {
      expertType = normalizeExpertId(args.expertType.trim());
      if (expertType !== CUSTOM_EXPERT_TYPE && !isPresetExpertType(expertType)) {
        getAdvisor(expertType);
      }
    } else {
      const pick = pickExpertTypeForNewAdvisor(nodes);
      expertType = pick.expertType;
      if (!title) title = pick.defaultTitle;
    }
    if (!title) title = defaultTitleForExpertType(expertType);
  } else {
    title =
      title ||
      (args.kind === "section" ? "New section" : DEFAULT_TITLE);
  }

  const sortOrder = nextSortOrder(
    nodes.map((n) => ({
      parentId: n.parentId,
      sortOrder: n.sortOrder,
      archived: n.archived,
    })),
    parentId,
  );

  const id = await withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO conversations (owner_id, title) VALUES ($1, $2) RETURNING id`,
      [args.ownerId, title],
    );
    const conversationId = rows[0]!.id;
    await upsertRailMeta(client, {
      ownerId: args.ownerId,
      conversationId,
      meta: toRailMeta({
        kind: args.kind,
        parentId,
        sortOrder,
        archived: false,
        expertType,
        customRole: null,
      }),
      existingMessageId: null,
    });
    return conversationId;
  });

  const now = new Date().toISOString();
  return {
    id,
    title: displayTitle(title),
    kind: args.kind,
    parentId,
    sortOrder,
    archived: false,
    expertType,
    customRole: null,
    advisorId: expertType,
    messageCount: 0,
    createdAt: now,
    lastActivityAt: now,
    anchor: null,
  };
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
    meta: toRailMeta({
      kind: node.kind,
      parentId: node.parentId,
      sortOrder: node.sortOrder,
      archived: args.archived,
      expertType: node.expertType,
      customRole: node.customRole,
    }),
    existingMessageId: m?.railMessageId ?? null,
  });

  const list = await listRailNodes(args.ownerId);
  const updated = list.find((n) => n.id === args.nodeId);
  if (!updated) throw new ConversationNotFoundError(args.nodeId);
  return updated;
}

export async function setRailCustomRole(args: {
  ownerId: string;
  nodeId: string;
  customRole: string;
}): Promise<RailNode> {
  const customRole = args.customRole.trim();
  if (!customRole) {
    throw new RailValidationError("customRole is required.");
  }

  const ensured = await listRailNodes(args.ownerId);
  const node = ensured.find((n) => n.id === args.nodeId);
  if (!node) throw new ConversationNotFoundError(args.nodeId);
  if (node.kind !== "advisor") {
    throw new RailValidationError("Solo un advisor puede definir su rol.");
  }
  if (node.expertType !== CUSTOM_EXPERT_TYPE) {
    throw new RailValidationError("Solo un asesor personalizado puede definir su rol.");
  }

  const markers = await loadSystemMarkers(args.ownerId);
  const m = markers.get(args.nodeId);
  await upsertRailMeta(getPool(), {
    ownerId: args.ownerId,
    conversationId: args.nodeId,
    meta: toRailMeta({
      kind: node.kind,
      parentId: node.parentId,
      sortOrder: node.sortOrder,
      archived: node.archived,
      expertType: node.expertType,
      customRole,
    }),
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
      const meta = toRailMeta({
        kind: current.kind,
        parentId: id === args.nodeId ? args.parentId : current.parentId,
        sortOrder: i,
        archived: false,
        expertType: current.expertType,
        customRole: current.customRole,
      });
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
      const meta = toRailMeta({
        kind: child.kind,
        parentId: node.parentId,
        sortOrder: child.sortOrder,
        archived: child.archived,
        expertType: child.expertType,
        customRole: child.customRole,
      });
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
