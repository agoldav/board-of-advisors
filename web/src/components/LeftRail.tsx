import { useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { SettingsPanel } from "./SettingsPanel";
import { useConversations } from "../conversations/context";

type RailActive =
  | "documents"
  | "reading"
  | "chat"
  | "commitments"
  | "none";

function resolveActive(pathname: string): RailActive {
  if (pathname.startsWith("/documentos") || pathname.startsWith("/cifras")) return "documents";
  if (pathname.startsWith("/lectura")) return "reading";
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/compromisos")) return "commitments";
  return "none";
}

export function LeftRail() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = resolveActive(pathname);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const {
    items,
    error: listError,
    createThread,
    deleteThread,
    exportThread,
    importThread,
  } = useConversations();

  const sectionActive = active === "commitments" ? "compromisos" : active === "documents" ? "documentos" : null;
  const activeThreadId = pathname.startsWith("/chat/")
    ? pathname.slice("/chat/".length).split("/")[0]
    : null;

  const topLevel = items.filter((t) => !t.anchor);
  const childrenByParent = new Map<string, typeof items>();
  for (const t of items) {
    const parentId = t.anchor?.parentConversationId;
    if (!parentId) continue;
    const list = childrenByParent.get(parentId) ?? [];
    list.push(t);
    childrenByParent.set(parentId, list);
  }
  const orphanParagraphs = items.filter(
    (t) =>
      t.anchor &&
      (!t.anchor.parentConversationId ||
        !items.some((p) => p.id === t.anchor?.parentConversationId)),
  );

  function renderThreadRow(thread: (typeof items)[number]) {
    return (
      <div
        key={thread.id}
        className={`tree-row-wrap ${activeThreadId === thread.id ? "is-active" : ""}`}
      >
        <NavLink
          to={`/chat/${thread.id}`}
          className={`tree-row ${activeThreadId === thread.id ? "is-active" : ""}`}
        >
          <span className="elbow" />
          <span className="tree-label">{thread.title}</span>
        </NavLink>
        <div className="tree-actions">
          <button
            type="button"
            className="tree-icon-btn"
            title="Exportar hilo"
            onClick={() => {
              void exportThread(thread.id).catch((err: unknown) => {
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
            disabled={items.length <= 1}
            onClick={() => void onDelete(thread.id)}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  async function onCreate() {
    try {
      const item = await createThread();
      navigate(`/chat/${item.id}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo crear el hilo.");
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("¿Borrar este hilo? Los mensajes se pierden (podés exportarlo antes).")) {
      return;
    }
    try {
      const nextId = await deleteThread(id);
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
      navigate(`/chat/${item.id}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo importar el hilo.");
    }
  }

  return (
    <>
      <aside className="rail">
        <div className="rail-brand">
          <div className="brand-mark" />
          <div className="serif brand-name">Board of Advisors</div>
        </div>

        <button type="button" className="rail-create" disabled title="Pendiente">
          <span className="plus-box">+</span>
          <span className="mono create-label">Create new advisor</span>
        </button>

        <div className="advisors-panel">
          <div className="advisors-head">
            <span>Financial Advisor</span>
            <span className="mono accent-count">{items.length}</span>
          </div>
          <div className="thread-tree">
            {listError && <div className="tree-error">{listError}</div>}
            {[...topLevel, ...orphanParagraphs].map((thread) => (
              <div key={thread.id}>
                {renderThreadRow(thread)}
                {(childrenByParent.get(thread.id) ?? []).length > 0 && (
                  <div className="thread-tree nested">
                    {(childrenByParent.get(thread.id) ?? []).map((child) =>
                      renderThreadRow(child),
                    )}
                  </div>
                )}
              </div>
            ))}
            <button type="button" className="tree-row tree-row-action" onClick={() => void onCreate()}>
              <span className="elbow" />
              <span>Nuevo hilo</span>
            </button>
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
            <div className="thread-tree nested">
              <NavLink
                to="/lectura"
                className={`tree-row ${active === "reading" ? "is-active" : ""}`}
              >
                <span className="elbow" />
                <span>Primera lectura</span>
              </NavLink>
            </div>
          </div>
          <div className="other-advisors">
            <div className="advisor-plain">Marketing Advisor</div>
            <div className="advisor-plain">Sales Advisor</div>
            <div className="advisor-plain">Operations Advisor</div>
          </div>
        </div>

        <div className="sections-block">
          <button type="button" className="rail-create" disabled title="Pendiente">
            <span className="plus-box">+</span>
            <span className="mono create-label">Create new section</span>
          </button>
          <div className="section-list">
            <div className="section-row">
              <span>Perfil Empresarial</span>
            </div>
            <div className="section-row">
              <span>Sales Advisor</span>
              <span className="unread-badge">2</span>
            </div>
            <div className="section-row">
              <span>Operations Advisor</span>
              <span className="mono muted-count">3</span>
            </div>
            <NavLink
              to="/compromisos"
              className={`section-row ${sectionActive === "compromisos" ? "is-active" : ""}`}
            >
              <span>Compromisos</span>
              <span className={`mono ${sectionActive === "compromisos" ? "active-badge" : "error-count"}`}>
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

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
