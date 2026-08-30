/**
 * Rail tree nodes (Pending item 4): advisors / sections / threads.
 * Stored as a system message so we do not alter schema 0001.
 */

export const RAIL_PREFIX = "__boa_rail_v1__";

export type RailKind = "advisor" | "section" | "thread";

export type RailMeta = {
  kind: RailKind;
  parentId: string | null;
  sortOrder: number;
  archived: boolean;
  /** Preset slug (financiero, mercadeo, …) or "custom" (D-040). */
  expertType?: string;
  /** Owner-defined role for custom advisors (D-041). */
  customRole?: string;
  /** @deprecated Legacy alias for expertType on preset advisors. */
  advisorId?: string;
};

export function serializeRailMeta(meta: RailMeta): string {
  return `${RAIL_PREFIX}\n${JSON.stringify(meta)}`;
}

export function parseRailMeta(content: string): RailMeta | null {
  if (!content.startsWith(RAIL_PREFIX)) return null;
  const raw = content.slice(RAIL_PREFIX.length).trim();
  try {
    const obj = JSON.parse(raw) as Partial<RailMeta>;
    if (obj.kind !== "advisor" && obj.kind !== "section" && obj.kind !== "thread") {
      return null;
    }
    const sortOrder =
      typeof obj.sortOrder === "number" && Number.isFinite(obj.sortOrder)
        ? obj.sortOrder
        : 0;
    const parentId =
      typeof obj.parentId === "string" && obj.parentId.trim()
        ? obj.parentId.trim()
        : null;
    const meta: RailMeta = {
      kind: obj.kind,
      parentId,
      sortOrder,
      archived: Boolean(obj.archived),
    };
    const expertType =
      typeof obj.expertType === "string" && obj.expertType.trim()
        ? obj.expertType.trim()
        : typeof obj.advisorId === "string" && obj.advisorId.trim()
          ? obj.advisorId.trim()
          : undefined;
    if (expertType) meta.expertType = expertType;
    if (typeof obj.customRole === "string" && obj.customRole.trim()) {
      meta.customRole = obj.customRole.trim();
    }
    if (typeof obj.advisorId === "string" && obj.advisorId.trim()) {
      meta.advisorId = obj.advisorId.trim();
    }
    return meta;
  } catch {
    return null;
  }
}

export function wouldCreateCycle(args: {
  nodeId: string;
  newParentId: string | null;
  parentById: Map<string, string | null>;
}): boolean {
  if (!args.newParentId) return false;
  if (args.newParentId === args.nodeId) return true;
  let cur: string | null = args.newParentId;
  const seen = new Set<string>();
  while (cur) {
    if (cur === args.nodeId) return true;
    if (seen.has(cur)) return true;
    seen.add(cur);
    cur = args.parentById.get(cur) ?? null;
  }
  return false;
}
