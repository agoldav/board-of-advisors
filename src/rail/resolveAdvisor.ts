/**
 * Resolve which board expert answers a conversation from the rail tree (D-040).
 */
import { CUSTOM_EXPERT_TYPE, isPresetExpertType } from "../advisors/presets.js";
import { getAdvisor, normalizeExpertId } from "../advisors/registry.js";
import { listRailNodes, type RailNode } from "./service.js";

export type AdvisorContext = {
  /** Preset slug or "custom". */
  expertType: string;
  /** Engine id: preset slug or "custom". */
  advisorId: string;
  /** Name the owner assigned on the rail card — the visible expert identity. */
  displayTitle: string;
  customRole: string | null;
  needsRoleDescription: boolean;
  railNodeId: string | null;
};

function resolveExpertType(raw: string | null | undefined): string {
  if (!raw?.trim()) return "financiero";
  const normalized = normalizeExpertId(raw.trim());
  if (normalized === CUSTOM_EXPERT_TYPE) return CUSTOM_EXPERT_TYPE;
  if (isPresetExpertType(normalized)) return normalized;
  try {
    getAdvisor(normalized);
    return normalized;
  } catch {
    return "financiero";
  }
}

function findAdvisorAncestor(
  conversationId: string,
  byId: Map<string, RailNode>,
): RailNode | null {
  let cur = byId.get(conversationId);
  if (!cur) return null;
  if (cur.kind === "advisor") return cur;

  const seen = new Set<string>();
  while (cur?.parentId && !seen.has(cur.parentId)) {
    seen.add(cur.parentId);
    const parent = byId.get(cur.parentId);
    if (!parent) break;
    if (parent.kind === "advisor") return parent;
    cur = parent;
  }
  return null;
}

export function resolveAdvisorContextFromNodes(
  nodes: RailNode[],
  conversationId: string,
): AdvisorContext {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const advisorNode = findAdvisorAncestor(conversationId, byId);

  const expertType = resolveExpertType(
    advisorNode?.expertType ?? advisorNode?.advisorId ?? null,
  );
  const displayTitle = advisorNode?.title?.trim() || "Asesor";
  const customRole = advisorNode?.customRole?.trim() || null;
  const isCustom = expertType === CUSTOM_EXPERT_TYPE;

  return {
    expertType,
    advisorId: isCustom ? CUSTOM_EXPERT_TYPE : expertType,
    displayTitle,
    customRole,
    needsRoleDescription: isCustom && !customRole,
    railNodeId: advisorNode?.id ?? null,
  };
}

export async function resolveAdvisorContext(
  ownerId: string,
  conversationId: string,
): Promise<AdvisorContext> {
  const nodes = await listRailNodes(ownerId);
  return resolveAdvisorContextFromNodes(nodes, conversationId);
}
