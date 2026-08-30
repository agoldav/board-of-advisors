import { describe, expect, it } from "vitest";
import { resolveAdvisorContextFromNodes } from "./resolveAdvisor.js";
import type { RailNode } from "./service.js";

function node(partial: Partial<RailNode> & Pick<RailNode, "id" | "kind">): RailNode {
  return {
    title: partial.title ?? partial.id,
    parentId: partial.parentId ?? null,
    sortOrder: partial.sortOrder ?? 0,
    archived: partial.archived ?? false,
    expertType: partial.expertType ?? partial.advisorId ?? null,
    customRole: partial.customRole ?? null,
    advisorId: partial.advisorId ?? partial.expertType ?? null,
    messageCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActivityAt: "2026-01-01T00:00:00.000Z",
    anchor: null,
    ...partial,
  };
}

describe("resolveAdvisorContextFromNodes", () => {
  const nodes: RailNode[] = [
    node({
      id: "a1",
      kind: "advisor",
      title: "Mi CFO",
      expertType: "financiero",
    }),
    node({
      id: "a2",
      kind: "advisor",
      title: "Operaciones",
      expertType: "operaciones",
    }),
    node({
      id: "t1",
      kind: "thread",
      title: "Hilo ops",
      parentId: "a2",
    }),
    node({
      id: "s1",
      kind: "section",
      title: "Subs",
      parentId: "a1",
    }),
    node({
      id: "t2",
      kind: "thread",
      title: "Hilo fin",
      parentId: "s1",
    }),
    node({
      id: "c1",
      kind: "advisor",
      title: "Estratega LATAM",
      expertType: "custom",
    }),
  ];

  it("uses the rail card title as the expert identity", () => {
    const ctx = resolveAdvisorContextFromNodes(nodes, "a1");
    expect(ctx.expertType).toBe("financiero");
    expect(ctx.advisorId).toBe("financiero");
    expect(ctx.displayTitle).toBe("Mi CFO");
    expect(ctx.railNodeId).toBe("a1");
    expect(ctx.needsRoleDescription).toBe(false);
  });

  it("inherits expert type from parent advisor for nested threads", () => {
    const ctx = resolveAdvisorContextFromNodes(nodes, "t1");
    expect(ctx.expertType).toBe("operaciones");
    expect(ctx.displayTitle).toBe("Operaciones");
    expect(ctx.railNodeId).toBe("a2");
  });

  it("walks through sections to find the advisor ancestor", () => {
    const ctx = resolveAdvisorContextFromNodes(nodes, "t2");
    expect(ctx.expertType).toBe("financiero");
    expect(ctx.displayTitle).toBe("Mi CFO");
    expect(ctx.railNodeId).toBe("a1");
  });

  it("flags custom advisors that still need a role description", () => {
    const ctx = resolveAdvisorContextFromNodes(nodes, "c1");
    expect(ctx.expertType).toBe("custom");
    expect(ctx.needsRoleDescription).toBe(true);
    expect(ctx.displayTitle).toBe("Estratega LATAM");
  });

  it("defaults to financiero for unknown conversations", () => {
    const ctx = resolveAdvisorContextFromNodes(nodes, "missing");
    expect(ctx.expertType).toBe("financiero");
    expect(ctx.railNodeId).toBeNull();
  });

  it("maps legacy finance marker ids", () => {
    const legacy = [
      node({
        id: "legacy",
        kind: "advisor",
        title: "Finanzas",
        advisorId: "finance",
      }),
    ];
    const ctx = resolveAdvisorContextFromNodes(legacy, "legacy");
    expect(ctx.expertType).toBe("financiero");
  });
});
