import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { SettingsPanel } from "./SettingsPanel";
import { useConversations } from "../conversations/context";
import {
  createRailNodeApi,
  deleteRailNodeApi,
  fetchRail,
  patchRailNodeApi,
  type RailKind,
  type RailNode,
} from "../api/client";
import { formatRelativeShort, formatRelativeTitle } from "../lib/relativeTime";

type RailActive =
  | "documents"
  | "reading"
  | "chat"
  | "commitments"
  | "none";

type MenuState = { id: string; x: number; y: number } | null;

const DEFAULT_THREAD_TITLE = "Nuevo hilo";

type DragPayload = { id: string };

function isPendingNode(id: string): boolean {
  return id.startsWith("pending-");
}

function resolveActive(pathname: string): RailActive {
  if (pathname.startsWith("/documentos") || pathname.startsWith("/cifras")) {
    return "documents";
  }
  if (pathname.startsWith("/lectura")) return "reading";
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/compromisos")) return "commitments";
  return "none";
}

function compareNodes(a: RailNode, b: RailNode): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.createdAt.localeCompare(b.createdAt);
}

function childrenOf(nodes: RailNode[], parentId: string | null): RailNode[] {
  return nodes
    .filter((n) => !n.archived && (n.parentId ?? null) === parentId)
    .sort(compareNodes);
}

/** Map a slot between advisor cards to a root-level sibling index. */
function rootIndexForAdvisorSlot(
  nodes: RailNode[],
  slotIndex: number,
  draggedId: string,
): number {
  const visible = nodes.filter((n) => !n.archived);
  const roots = childrenOf(
    visible.filter((n) => n.id !== draggedId),
    null,
  );
  const advisors = roots.filter((n) => n.kind === "advisor");
  if (advisors.length === 0) return 0;
  if (slotIndex <= 0) {
    return roots.findIndex((n) => n.id === advisors[0]!.id);
  }
  if (slotIndex >= advisors.length) {
    const last = advisors[advisors.length - 1]!;
    return roots.findIndex((n) => n.id === last.id) + 1;
  }
  const anchor = advisors[slotIndex]!;
  return roots.findIndex((n) => n.id === anchor.id);
}

function reorderAdvisorOptimistic(
  nodes: RailNode[],
  nodeId: string,
  slotIndex: number,
): { next: RailNode[]; index: number; changed: boolean } | null {
  const node = nodes.find((n) => n.id === nodeId && !n.archived);
  if (!node || node.kind !== "advisor") return null;

  const visible = nodes.filter((n) => !n.archived);
  const roots = childrenOf(visible, null);
  const withoutDragged = roots.filter((n) => n.id !== nodeId);
  const targetIndex = rootIndexForAdvisorSlot(nodes, slotIndex, nodeId);
  const nextRoots = [
    ...withoutDragged.slice(0, targetIndex),
    node,
    ...withoutDragged.slice(targetIndex),
  ];
  const changed = nextRoots.some((n, i) => n.id !== roots[i]?.id);
  if (!changed) {
    return { next: nodes, index: targetIndex, changed: false };
  }

  const orderById = new Map(nextRoots.map((n, i) => [n.id, i]));
  return {
    next: nodes.map((n) => {
      const order = orderById.get(n.id);
      if (order === undefined) return n;
      if (n.sortOrder === order && (n.parentId ?? null) === null) return n;
      return { ...n, parentId: null, sortOrder: order };
    }),
    index: targetIndex,
    changed: true,
  };
}

const RAIL_WIDTH_KEY = "boa-rail-width";
const RAIL_COLLAPSED_KEY = "boa-rail-collapsed";
const RAIL_WIDTH_DEFAULT = 260;
const RAIL_WIDTH_MIN = 200;
const RAIL_WIDTH_MAX = 480;

function loadRailWidth(): number {
  try {
    const n = Number(localStorage.getItem(RAIL_WIDTH_KEY));
    if (Number.isFinite(n) && n >= RAIL_WIDTH_MIN && n <= RAIL_WIDTH_MAX) return n;
  } catch {
    /* ignore */
  }
  return RAIL_WIDTH_DEFAULT;
}

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(RAIL_COLLAPSED_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

function latestActivityInSubtree(nodeId: string, nodes: RailNode[]): string {
  const node = nodes.find((n) => n.id === nodeId && !n.archived);
  if (!node) return new Date(0).toISOString();

  let latest = node.lastActivityAt;
  for (const child of nodes) {
    if (child.archived || child.parentId !== nodeId) continue;
    const childLatest = latestActivityInSubtree(child.id, nodes);
    if (childLatest > latest) latest = childLatest;
  }
  return latest;
}

function ancestorIds(nodeId: string, nodes: RailNode[]): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: string[] = [];
  let cur = byId.get(nodeId);
  while (cur?.parentId) {
    out.push(cur.parentId);
    cur = byId.get(cur.parentId);
  }
  return out;
}

export function LeftRail() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = resolveActive(pathname);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menu, setMenu] = useState<MenuState>(null);
  const [nodes, setNodes] = useState<RailNode[]>([]);
  const [railError, setRailError] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<"advisors" | "sections" | null>(
    null,
  );
  const [dragOverAdvisorIndex, setDragOverAdvisorIndex] = useState<number | null>(
    null,
  );
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [railWidth, setRailWidth] = useState(loadRailWidth);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsed());
  const [resizing, setResizing] = useState(false);
  const [nowTick, setNowTick] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    session,
    error: listError,
    deleteThread,
    exportThread,
    importThread,
    refresh: refreshConversations,
  } = useConversations();

  const sectionActive =
    active === "commitments"
      ? "compromisos"
      : active === "documents"
        ? "documentos"
        : null;
  const activeThreadId = pathname.startsWith("/chat/")
    ? pathname.slice("/chat/".length).split("/")[0]
    : null;

  async function refreshRail(syncConversations = true) {
    const s = session;
    if (!s) return;
    const items = await fetchRail(s.ownerId);
    setNodes(items);
    if (syncConversations) {
      void refreshConversations();
    }
  }

  function upsertRailNode(item: RailNode) {
    setNodes((prev) => {
      const i = prev.findIndex((n) => n.id === item.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = item;
        return next;
      }
      return [...prev, item];
    });
  }

  function expandNodes(...ids: Array<string | null | undefined>) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ids) {
        if (id && next.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      if (!changed) return prev;
      localStorage.setItem(RAIL_COLLAPSED_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function makePendingNode(args: {
    token: string;
    kind: RailKind;
    title: string;
    parentId: string | null;
  }): RailNode {
    const now = new Date().toISOString();
    const label =
      args.title.trim() ||
      (args.kind === "advisor"
        ? "New advisor"
        : args.kind === "section"
          ? "New section"
          : DEFAULT_THREAD_TITLE);
    return {
      id: `pending-${args.token}`,
      title: label,
      kind: args.kind,
      parentId: args.parentId,
      sortOrder: Date.now(),
      archived: false,
      advisorId: null,
      messageCount: 0,
      createdAt: now,
      lastActivityAt: now,
      anchor: null,
    };
  }

  async function persistNewNode(args: {
    kind: RailKind;
    title?: string;
    parentId?: string | null;
  }) {
    if (!session) return;
    const token = crypto.randomUUID();
    const parentId = args.parentId ?? null;
    const pending = makePendingNode({
      token,
      kind: args.kind,
      title: args.title ?? "",
      parentId,
    });
    upsertRailNode(pending);
    expandNodes(parentId);

    try {
      const item = await createRailNodeApi({
        ownerId: session.ownerId,
        kind: args.kind,
        title: args.title?.trim() || undefined,
        parentId,
      });
      setNodes((prev) => {
        const rest = prev.filter((n) => n.id !== pending.id);
        const i = rest.findIndex((n) => n.id === item.id);
        if (i >= 0) {
          const next = [...rest];
          next[i] = item;
          return next;
        }
        return [...rest, item];
      });
      navigate(`/chat/${item.id}`);
      void refreshConversations();
    } catch (err) {
      setNodes((prev) => prev.filter((n) => n.id !== pending.id));
      window.alert(err instanceof Error ? err.message : "No se pudo crear.");
    }
  }

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const items = await fetchRail(session.ownerId);
        if (!cancelled) {
          setNodes(items);
          setRailError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setRailError(
            err instanceof Error ? err.message : "No se pudo cargar el rail.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!menu) return;
    function onDoc(e: globalThis.MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(null);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const visible = useMemo(() => nodes.filter((n) => !n.archived), [nodes]);

  const advisorDragActive = useMemo(() => {
    if (!draggingNodeId) return false;
    return visible.find((n) => n.id === draggingNodeId)?.kind === "advisor";
  }, [draggingNodeId, visible]);

  useEffect(() => {
    if (!advisorDragActive || !draggingNodeId || !session) return;

    const nodeId = draggingNodeId;
    const ownerId = session.ownerId;

    function advisorSlotAt(clientX: number, clientY: number): number | null {
      const stack = document.querySelector(".advisors-stack.is-advisor-drag");
      if (!stack) return null;

      const stackRect = stack.getBoundingClientRect();
      if (
        clientX < stackRect.left - 12 ||
        clientX > stackRect.right + 12 ||
        clientY < stackRect.top ||
        clientY > stackRect.bottom
      ) {
        return null;
      }

      const wraps = [
        ...stack.querySelectorAll(":scope > .advisor-slot"),
      ] as HTMLElement[];

      const blocks: Array<{ slot: number; rect: DOMRect }> = [];
      for (let i = 0; i < wraps.length; i++) {
        const block = wraps[i]?.querySelector(".advisor-block");
        if (!block || block.classList.contains("is-dragging")) continue;
        blocks.push({ slot: i, rect: block.getBoundingClientRect() });
      }

      if (blocks.length === 0) return 0;

      const first = blocks[0]!;
      if (clientY <= first.rect.top + 6) return first.slot;

      const last = blocks[blocks.length - 1]!;
      if (clientY >= last.rect.bottom - 6) return last.slot + 1;

      for (let i = 0; i < blocks.length; i++) {
        const cur = blocks[i]!;
        const next = blocks[i + 1];
        if (clientY >= cur.rect.top && clientY <= cur.rect.bottom) {
          const mid = cur.rect.top + cur.rect.height / 2;
          return clientY < mid ? cur.slot : cur.slot + 1;
        }
        if (next && clientY > cur.rect.bottom && clientY < next.rect.top) {
          const gapMid = (cur.rect.bottom + next.rect.top) / 2;
          return clientY < gapMid ? cur.slot + 1 : next.slot;
        }
      }

      return blocks.length;
    }

    let lastSlot: number | null = null;

    function onMove(e: PointerEvent) {
      const slot = advisorSlotAt(e.clientX, e.clientY);
      lastSlot = slot;
      setDragOverAdvisorIndex(slot);
    }

    function onUp(e: PointerEvent) {
      const slot = advisorSlotAt(e.clientX, e.clientY) ?? lastSlot;

      draggingId.current = null;
      setDraggingNodeId(null);
      setDragOverAdvisorIndex(null);
      setDragOverId(null);
      setDragOverZone(null);

      if (slot === null) return;

      let rollback: RailNode[] | null = null;
      let apiIndex = 0;
      let shouldSync = false;

      setNodes((prev) => {
        rollback = prev;
        const result = reorderAdvisorOptimistic(prev, nodeId, slot);
        if (!result?.changed) return prev;
        apiIndex = result.index;
        shouldSync = true;
        return result.next;
      });

      if (!shouldSync) return;

      void patchRailNodeApi({
        ownerId,
        nodeId,
        parentId: null,
        index: apiIndex,
      }).catch((err) => {
        if (rollback) setNodes(rollback);
        window.alert(err instanceof Error ? err.message : "No se pudo mover.");
      });
    }

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [advisorDragActive, draggingNodeId, session, visible]);

  useEffect(() => {
    if (!activeThreadId || visible.length === 0) return;
    const ancestors = ancestorIds(activeThreadId, visible);
    if (ancestors.length === 0) return;
    setCollapsed((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of ancestors) {
        if (next.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      if (!changed) return prev;
      localStorage.setItem(RAIL_COLLAPSED_KEY, JSON.stringify([...next]));
      return next;
    });
  }, [activeThreadId, visible]);

  const topAdvisors = childrenOf(visible, null).filter((n) => n.kind === "advisor");
  const railNow = useMemo(() => Date.now(), [nowTick]);
  const topSections = childrenOf(visible, null).filter((n) => n.kind === "section");
  const topOrphans = childrenOf(visible, null).filter(
    (n) => n.kind !== "advisor" && n.kind !== "section",
  );

  const menuNode = menu ? nodes.find((n) => n.id === menu.id) : null;

  function isCollapsed(id: string): boolean {
    return collapsed.has(id);
  }

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(RAIL_COLLAPSED_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function startRailResize(e: ReactMouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = railWidth;
    setResizing(true);
    function onMove(ev: globalThis.MouseEvent) {
      const w = Math.min(
        RAIL_WIDTH_MAX,
        Math.max(RAIL_WIDTH_MIN, startW + ev.clientX - startX),
      );
      setRailWidth(w);
    }
    function onUp() {
      setResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setRailWidth((w) => {
        localStorage.setItem(RAIL_WIDTH_KEY, String(w));
        return w;
      });
    }
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function CollapseChevron({
    nodeId,
    visible: show,
  }: {
    nodeId: string;
    visible: boolean;
  }) {
    if (!show) return <span className="tree-chevron spacer" aria-hidden />;
    const shut = isCollapsed(nodeId);
    return (
      <button
        type="button"
        className={`tree-chevron ${shut ? "is-collapsed" : ""}`}
        aria-expanded={!shut}
        aria-label={shut ? "Expandir" : "Colapsar"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleCollapsed(nodeId);
        }}
      >
        ▼
      </button>
    );
  }

  async function onCreate(kind: "advisor" | "section") {
    if (!session) return;
    const title = window.prompt(
      kind === "advisor" ? "Nombre del advisor" : "Nombre de la sección",
      kind === "advisor" ? "New advisor" : "New section",
    );
    if (title === null) return;
    void persistNewNode({ kind, title: title.trim() });
  }

  async function onCreateSub(parent: RailNode) {
    if (!session) return;
    const title = window.prompt("Nombre del sub (sección/chat)", "New section");
    if (title === null) return;
    void persistNewNode({
      kind: "section",
      title: title.trim(),
      parentId: parent.id,
    });
  }

  async function onRename(node: RailNode) {
    if (!session) return;
    const title = window.prompt("Renombrar", node.title);
    if (title === null) return;
    try {
      await patchRailNodeApi({
        ownerId: session.ownerId,
        nodeId: node.id,
        title,
      });
      await refreshRail();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo renombrar.");
    }
  }

  async function onArchive(node: RailNode) {
    if (!session) return;
    try {
      await patchRailNodeApi({
        ownerId: session.ownerId,
        nodeId: node.id,
        archived: true,
      });
      await refreshRail();
      if (activeThreadId === node.id) {
        const next = (await fetchRail(session.ownerId)).find((n) => !n.archived);
        navigate(next ? `/chat/${next.id}` : "/chat");
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo archivar.");
    }
  }

  async function onDelete(node: RailNode) {
    if (!session) return;
    if (
      !window.confirm(
        `¿Borrar “${node.title}”? Los hijos pasan al nivel del padre.`,
      )
    ) {
      return;
    }
    try {
      await deleteRailNodeApi(session.ownerId, node.id);
      await refreshRail();
      if (activeThreadId === node.id) {
        const next = (await fetchRail(session.ownerId)).find((n) => !n.archived);
        navigate(next ? `/chat/${next.id}` : "/chat");
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo borrar.");
    }
  }

  async function onCreateThreadUnder(parentId: string | null) {
    if (!session) return;
    void persistNewNode({ kind: "thread", parentId });
  }

  async function onDeleteLegacy(id: string) {
    if (!window.confirm("¿Borrar este hilo? Los mensajes se pierden (podés exportarlo antes).")) {
      return;
    }
    try {
      const nextId = await deleteThread(id);
      await refreshRail();
      if (activeThreadId === id) {
        navigate(nextId ? `/chat/${nextId}` : "/chat");
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo borrar el hilo.");
    }
  }

  async function onImport(file: File) {
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const item = await importThread(payload);
      await refreshRail();
      navigate(`/chat/${item.id}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo importar el hilo.");
    }
  }

  function openMenu(e: ReactMouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ id, x: rect.right - 160, y: rect.bottom + 4 });
  }

  function onDragStart(e: DragEvent, id: string) {
    const payload: DragPayload = { id };
    e.dataTransfer.setData("application/x-boa-rail", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }

  const draggingId = useRef<string | null>(null);

  function handleDragStart(e: DragEvent, id: string) {
    draggingId.current = id;
    setDraggingNodeId(id);
    onDragStart(e, id);
  }

  function startAdvisorDrag(advisorId: string) {
    if (isPendingNode(advisorId)) return;
    draggingId.current = advisorId;
    setDraggingNodeId(advisorId);
  }

  function handleDragEnd() {
    draggingId.current = null;
    setDraggingNodeId(null);
    setDragOverId(null);
    setDragOverZone(null);
    setDragOverAdvisorIndex(null);
  }

  function draggedNode(): RailNode | null {
    const id = draggingNodeId ?? draggingId.current;
    if (!id) return null;
    return visible.find((n) => n.id === id) ?? null;
  }

  async function applyDrop(args: {
    parentId: string | null;
    index: number;
  }) {
    if (!session || !draggingId.current) return;
    const nodeId = draggingId.current;
    if (!nodeId) return;
    const node = visible.find((n) => n.id === nodeId);
    const advisorSlot =
      dragOverAdvisorIndex !== null ? dragOverAdvisorIndex : args.index;
    draggingId.current = null;
    setDraggingNodeId(null);
    setDragOverId(null);
    setDragOverZone(null);
    setDragOverAdvisorIndex(null);
    if (nodeId === args.parentId) return;

    let parentId = args.parentId;
    let index = args.index;
    if (node?.kind === "advisor") {
      parentId = null;
      index = rootIndexForAdvisorSlot(visible, advisorSlot, nodeId);
    }

    try {
      const data = await patchRailNodeApi({
        ownerId: session.ownerId,
        nodeId,
        parentId,
        index,
      });
      if (data.items) setNodes(data.items);
      else void refreshRail(false);
      void refreshConversations();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo mover.");
    }
  }

  function renderRailAge(node: RailNode, activityAt?: string) {
    if (isPendingNode(node.id)) return null;
    const at = activityAt ?? node.lastActivityAt;
    const tz = session?.timezone ?? "America/Costa_Rica";
    return (
      <span
        className="rail-age mono"
        title={formatRelativeTitle(at, tz)}
      >
        {formatRelativeShort(at, railNow)}
      </span>
    );
  }

  function renderKebab(node: RailNode) {
    return (
      <button
        type="button"
        className="tree-icon-btn kebab-btn"
        title="Más acciones"
        aria-label="Más acciones"
        onClick={(e) => openMenu(e, node.id)}
      >
        ⋮
      </button>
    );
  }

  function renderTree(parentId: string, depth: number): ReactNode {
    const kids = childrenOf(visible, parentId);
    if (kids.length === 0) return null;
    return (
      <div className={`thread-tree ${depth > 0 ? "nested" : ""}`}>
        {kids.map((node, index) => (
          <div key={node.id}>
            <div
              className={`tree-row-wrap ${activeThreadId === node.id ? "is-active" : ""} ${
                dragOverId === node.id ? "is-drop-target" : ""
              } ${isPendingNode(node.id) ? "is-pending" : ""}`}
              draggable={!isPendingNode(node.id)}
              onDragStart={(e) => handleDragStart(e, node.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverId(node.id);
              }}
              onDragLeave={() => {
                setDragOverId((cur) => (cur === node.id ? null : cur));
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const kidsCount = childrenOf(visible, node.id).length;
                void applyDrop({ parentId: node.id, index: kidsCount });
              }}
            >
              <CollapseChevron nodeId={node.id} visible />
              <NavLink
                to={`/chat/${node.id}`}
                className={`tree-row ${activeThreadId === node.id ? "is-active" : ""}`}
              >
                <span className="elbow" />
                <span className="tree-label">{node.title}</span>
                {renderRailAge(node)}
              </NavLink>
              <div className="tree-actions">
                {node.kind === "thread" && (
                  <>
                    <button
                      type="button"
                      className="tree-icon-btn"
                      title="Exportar hilo"
                      onClick={() => {
                        void exportThread(node.id).catch((err: unknown) => {
                          window.alert(
                            err instanceof Error ? err.message : "No se pudo exportar.",
                          );
                        });
                      }}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="tree-icon-btn"
                      title="Borrar hilo"
                      onClick={() => void onDeleteLegacy(node.id)}
                    >
                      ×
                    </button>
                  </>
                )}
                {renderKebab(node)}
              </div>
            </div>
            <div
              className="drop-slot"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void applyDrop({ parentId, index: index + 1 });
              }}
            />
            {!isCollapsed(node.id) && renderTree(node.id, depth + 1)}
          </div>
        ))}
      </div>
    );
  }

  function renderAdvisorInsertLine(index: number) {
    if (!advisorDragActive || dragOverAdvisorIndex !== index) return null;
    return <div className="advisor-insert-line" aria-hidden />;
  }

  function renderAdvisorBlock(advisor: RailNode) {
    const kids = childrenOf(visible, advisor.id);
    const advisorCollapsed = isCollapsed(advisor.id);
    return (
      <div
        className={`advisor-block ${dragOverId === advisor.id ? "is-drop-target" : ""} ${
          isPendingNode(advisor.id) ? "is-pending" : ""
        } ${draggingNodeId === advisor.id ? "is-dragging" : ""}`}
        onDragOver={(e) => {
          const dragging = draggedNode();
          if (dragging?.kind === "advisor") return;
          e.preventDefault();
          setDragOverId(advisor.id);
        }}
        onDragLeave={() => {
          setDragOverId((cur) => (cur === advisor.id ? null : cur));
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const dragging = draggedNode();
          if (dragging?.kind === "advisor") return;
          const kidsCount = kids.length;
          void applyDrop({ parentId: advisor.id, index: kidsCount });
        }}
      >
        <div
          className={`advisors-head ${activeThreadId === advisor.id ? "is-active" : ""}`}
        >
          <div className="advisor-head-left">
            <button
              type="button"
              className="advisor-drag-grip"
              aria-label="Arrastrá para reordenar"
              title="Arrastrá para reordenar"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startAdvisorDrag(advisor.id);
              }}
            >
              ⠿
            </button>
            <CollapseChevron nodeId={advisor.id} visible />
            <NavLink to={`/chat/${advisor.id}`} className="advisor-head-link">
              <span>{advisor.title}</span>
            </NavLink>
          </div>
          <div className="advisor-head-meta">
            {advisorCollapsed &&
              renderRailAge(advisor, latestActivityInSubtree(advisor.id, visible))}
            {renderKebab(advisor)}
          </div>
        </div>
        {!advisorCollapsed && (
          <>
            {renderTree(advisor.id, 0)}
            <div className="thread-tree">
              <button
                type="button"
                className="tree-row tree-row-action"
                onClick={() => void onCreateThreadUnder(advisor.id)}
              >
                <span className="elbow" />
                <span>Nuevo hilo</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderSectionRow(node: RailNode, index: number, parentId: string | null) {
    const sectionCollapsed = isCollapsed(node.id);
    return (
      <div key={node.id}>
        <div
          className={`section-row-wrap ${activeThreadId === node.id ? "is-active" : ""} ${
            dragOverId === node.id ? "is-drop-target" : ""
          } ${isPendingNode(node.id) ? "is-pending" : ""}`}
          draggable={!isPendingNode(node.id)}
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverId(node.id);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const kidsCount = childrenOf(visible, node.id).length;
            void applyDrop({ parentId: node.id, index: kidsCount });
          }}
        >
          <CollapseChevron nodeId={node.id} visible />
          <NavLink
            to={`/chat/${node.id}`}
            className={`section-row ${activeThreadId === node.id ? "is-active" : ""}`}
          >
            <span className="section-row-label">{node.title}</span>
            {renderRailAge(node)}
          </NavLink>
          <div className="section-actions">{renderKebab(node)}</div>
        </div>
        <div
          className="drop-slot"
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            void applyDrop({ parentId, index: index + 1 });
          }}
        />
        {!sectionCollapsed && renderTree(node.id, 0)}
      </div>
    );
  }

  return (
    <>
      <div className="rail-shell" style={{ width: railWidth }}>
        <aside className="rail">
        <div className="rail-brand">
          <div className="brand-mark" />
          <div className="serif brand-name">Board of Advisors</div>
        </div>

        <button
          type="button"
          className="rail-create is-active"
          onClick={() => void onCreate("advisor")}
        >
          <span className="plus-box">+</span>
          <span className="mono create-label">Create new advisor</span>
        </button>

        <div
          className={`advisors-stack ${advisorDragActive ? "is-advisor-drag" : ""}`}
        >
          {(railError || listError) && (
            <div className="tree-error">{railError || listError}</div>
          )}
          {topAdvisors.map((a, index) => (
            <div key={a.id} className="advisor-slot">
              {renderAdvisorInsertLine(index)}
              {renderAdvisorBlock(a)}
            </div>
          ))}
          {renderAdvisorInsertLine(topAdvisors.length)}
          {topOrphans.length > 0 && (
            <div className="advisors-utilities thread-tree">
              {topOrphans.map((node) => (
                <div
                  key={node.id}
                  className={`tree-row-wrap ${activeThreadId === node.id ? "is-active" : ""}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, node.id)}
                  onDragEnd={handleDragEnd}
                >
                  <NavLink
                    to={`/chat/${node.id}`}
                    className={`tree-row ${activeThreadId === node.id ? "is-active" : ""}`}
                  >
                    <span className="elbow" />
                    <span className="tree-label">{node.title}</span>
                    {renderRailAge(node)}
                  </NavLink>
                  <div className="tree-actions">{renderKebab(node)}</div>
                </div>
              ))}
            </div>
          )}
          <div className="advisors-utilities">
            <div className="thread-tree nested">
              <NavLink
                to="/lectura"
                className={`tree-row ${active === "reading" ? "is-active" : ""}`}
              >
                <span className="elbow" />
                <span>Primera lectura</span>
              </NavLink>
            </div>
            <button
              type="button"
              className="tree-row tree-row-action"
              onClick={() => importRef.current?.click()}
            >
              <span className="elbow" />
              <span>Importar hilo…</span>
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void onImport(file);
              }}
            />
          </div>
        </div>

        <div className="sections-block">
          <button
            type="button"
            className="rail-create is-active"
            onClick={() => void onCreate("section")}
          >
            <span className="plus-box">+</span>
            <span className="mono create-label">Create new section</span>
          </button>
          <div
            className={`section-list ${dragOverZone === "sections" ? "is-drop-target" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverZone("sections");
            }}
            onDragLeave={() => setDragOverZone(null)}
            onDrop={(e) => {
              e.preventDefault();
              // Dropping into sections zone at root — keep parent null; user can Create section for kind
              const rootCount = childrenOf(visible, null).length;
              void applyDrop({ parentId: null, index: rootCount });
            }}
          >
            {topSections.map((node, index) =>
              renderSectionRow(node, index, null),
            )}
            <NavLink
              to="/compromisos"
              className={`section-row ${sectionActive === "compromisos" ? "is-active" : ""}`}
            >
              <span>Compromisos</span>
              <span
                className={`mono ${
                  sectionActive === "compromisos" ? "active-badge" : "error-count"
                }`}
              >
                1 vencido
              </span>
            </NavLink>
            <NavLink
              to="/cifras"
              className={`section-row ${sectionActive === "documentos" ? "is-active" : ""}`}
            >
              <span>Documentos</span>
              <span className="mono muted-count">50</span>
            </NavLink>
          </div>
        </div>

        <div className="rail-spacer" />

        <button
          type="button"
          className="rail-footer rail-footer-btn"
          onClick={() => setSettingsOpen(true)}
        >
          <div className="company">Siscon S.R.L.</div>
          <div className="owner">Abraham · Goldgewicht - Gerente</div>
        </button>
        </aside>
        <div
          className={`rail-resize-handle ${resizing ? "is-dragging" : ""}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionar menú lateral"
          onMouseDown={startRailResize}
        />
      </div>

      {menu && menuNode && (
        <div
          ref={menuRef}
          className="rail-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(null);
              void onRename(menuNode);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(null);
              void onArchive(menuNode);
            }}
          >
            Archive
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(null);
              void onDelete(menuNode);
            }}
          >
            Delete
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(null);
              void onCreateSub(menuNode);
            }}
          >
            Create Sub
          </button>
        </div>
      )}

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
