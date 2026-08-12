import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { SettingsPanel } from "./SettingsPanel";
import { useConversations } from "../conversations/context";
import {
  createRailNodeApi,
  deleteRailNodeApi,
  fetchRail,
  patchRailNodeApi,
  type RailNode,
} from "../api/client";

type RailActive =
  | "documents"
  | "reading"
  | "chat"
  | "commitments"
  | "none";

type MenuState = { id: string; x: number; y: number } | null;

type DragPayload = { id: string };

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
  const importRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    session,
    error: listError,
    createThread,
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

  async function refreshRail() {
    const s = session;
    if (!s) return;
    const items = await fetchRail(s.ownerId);
    setNodes(items);
    await refreshConversations();
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
  const topAdvisors = childrenOf(visible, null).filter((n) => n.kind === "advisor");
  const topSections = childrenOf(visible, null).filter((n) => n.kind === "section");
  const topOrphans = childrenOf(visible, null).filter(
    (n) => n.kind !== "advisor" && n.kind !== "section",
  );

  const menuNode = menu ? nodes.find((n) => n.id === menu.id) : null;

  async function onCreate(kind: "advisor" | "section") {
    if (!session) return;
    const title = window.prompt(
      kind === "advisor" ? "Nombre del advisor" : "Nombre de la sección",
      kind === "advisor" ? "New advisor" : "New section",
    );
    if (title === null) return;
    try {
      const item = await createRailNodeApi({
        ownerId: session.ownerId,
        kind,
        title: title.trim() || undefined,
      });
      await refreshRail();
      navigate(`/chat/${item.id}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo crear.");
    }
  }

  async function onCreateSub(parent: RailNode) {
    if (!session) return;
    const title = window.prompt("Nombre del sub (sección/chat)", "New section");
    if (title === null) return;
    try {
      const item = await createRailNodeApi({
        ownerId: session.ownerId,
        kind: "section",
        title: title.trim() || undefined,
        parentId: parent.id,
      });
      await refreshRail();
      navigate(`/chat/${item.id}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo crear.");
    }
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
    try {
      const item = await createRailNodeApi({
        ownerId: session.ownerId,
        kind: "thread",
        parentId,
      });
      await refreshRail();
      navigate(`/chat/${item.id}`);
    } catch (err) {
      // Fallback to legacy create if needed
      try {
        const item = await createThread();
        navigate(`/chat/${item.id}`);
      } catch {
        window.alert(err instanceof Error ? err.message : "No se pudo crear el hilo.");
      }
    }
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
    onDragStart(e, id);
  }

  async function applyDrop(args: {
    parentId: string | null;
    index: number;
  }) {
    if (!session || !draggingId.current) return;
    const nodeId = draggingId.current;
    draggingId.current = null;
    setDragOverId(null);
    setDragOverZone(null);
    if (nodeId === args.parentId) return;
    try {
      const data = await patchRailNodeApi({
        ownerId: session.ownerId,
        nodeId,
        parentId: args.parentId,
        index: args.index,
      });
      if (data.items) setNodes(data.items);
      else await refreshRail();
      await refreshConversations();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo mover.");
    }
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
              }`}
              draggable
              onDragStart={(e) => handleDragStart(e, node.id)}
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
                // Drop onto node → nest as last child
                const kidsCount = childrenOf(visible, node.id).length;
                void applyDrop({ parentId: node.id, index: kidsCount });
              }}
            >
              <NavLink
                to={`/chat/${node.id}`}
                className={`tree-row ${activeThreadId === node.id ? "is-active" : ""}`}
              >
                <span className="elbow" />
                <span className="tree-label">
                  {node.kind === "section" ? node.title : node.title}
                </span>
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
            {/* Drop slot after this sibling */}
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
            {renderTree(node.id, depth + 1)}
          </div>
        ))}
      </div>
    );
  }

  function renderAdvisorBlock(advisor: RailNode) {
    const kids = childrenOf(visible, advisor.id);
    return (
      <div
        key={advisor.id}
        className={`advisor-block ${dragOverId === advisor.id ? "is-drop-target" : ""}`}
        draggable
        onDragStart={(e) => handleDragStart(e, advisor.id)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverId(advisor.id);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const kidsCount = kids.length;
          void applyDrop({ parentId: advisor.id, index: kidsCount });
        }}
      >
        <div
          className={`advisors-head ${activeThreadId === advisor.id ? "is-active" : ""}`}
        >
          <NavLink to={`/chat/${advisor.id}`} className="advisor-head-link">
            <span>{advisor.title}</span>
          </NavLink>
          <div className="advisor-head-meta">
            <span className="mono accent-count">{kids.length}</span>
            {renderKebab(advisor)}
          </div>
        </div>
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
      </div>
    );
  }

  function renderSectionRow(node: RailNode, index: number, parentId: string | null) {
    return (
      <div key={node.id}>
        <div
          className={`section-row-wrap ${activeThreadId === node.id ? "is-active" : ""} ${
            dragOverId === node.id ? "is-drop-target" : ""
          }`}
          draggable
          onDragStart={(e) => handleDragStart(e, node.id)}
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
          <NavLink
            to={`/chat/${node.id}`}
            className={`section-row ${activeThreadId === node.id ? "is-active" : ""}`}
          >
            <span>{node.title}</span>
            <span className="mono muted-count">{node.messageCount || ""}</span>
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
        {renderTree(node.id, 0)}
      </div>
    );
  }

  return (
    <>
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
          className={`advisors-panel ${dragOverZone === "advisors" ? "is-drop-target" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverZone("advisors");
          }}
          onDragLeave={() => setDragOverZone(null)}
          onDrop={(e) => {
            e.preventDefault();
            // Drop at end of top-level advisors: become top-level (parent null).
            // Kind stays whatever it was — advisors zone is just a drop target for root.
            const rootCount = childrenOf(visible, null).length;
            void applyDrop({ parentId: null, index: rootCount });
          }}
        >
          {(railError || listError) && (
            <div className="tree-error">{railError || listError}</div>
          )}
          {topAdvisors.map((a) => renderAdvisorBlock(a))}
          {topOrphans.length > 0 && (
            <div className="thread-tree">
              {topOrphans.map((node) => (
                <div
                  key={node.id}
                  className={`tree-row-wrap ${activeThreadId === node.id ? "is-active" : ""}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, node.id)}
                >
                  <NavLink
                    to={`/chat/${node.id}`}
                    className={`tree-row ${activeThreadId === node.id ? "is-active" : ""}`}
                  >
                    <span className="elbow" />
                    <span className="tree-label">{node.title}</span>
                  </NavLink>
                  <div className="tree-actions">{renderKebab(node)}</div>
                </div>
              ))}
            </div>
          )}
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
