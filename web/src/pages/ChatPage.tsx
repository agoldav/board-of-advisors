import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  attachConversationFile,
  fetchConversation,
  getDocumentId,
  patchRailNodeApi,
  regenerateConversationMessage,
  sendConversationMessage,
  sendEphemeralMessage,
  type AttachmentMeta,
  type ConversationDetail,
  type ConversationMessage,
} from "../api/client";
import { ChatMessageBlock } from "../components/ChatMessageBlock";
import { DocumentPane } from "../components/DocumentPane";
import { GhostIcon } from "../components/GhostIcon";
import { useConversations } from "../conversations/context";

type LocationState = { pendingQuestion?: string } | null;

const sentPendingKeys = new Set<string>();
const GHOST_MODE_KEY = "boa-ghost-mode";

function newLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatWhen(iso: string, timezone: string): string {
  try {
    return new Date(iso).toLocaleString("es-CR", {
      timeZone: timezone,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, items, refresh, renameThread } = useConversations();
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [ghostMessages, setGhostMessages] = useState<ConversationMessage[]>([]);
  const [ghostMode, setGhostMode] = useState(
    () => sessionStorage.getItem(GHOST_MODE_KEY) === "1",
  );
  const [draft, setDraft] = useState("");
  const [roleDraft, setRoleDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  const [attachBusy, setAttachBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<AttachmentMeta | null>(null);
  const [docOpen, setDocOpen] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showDoc = Boolean(attachment && docOpen && session);
  const advisorCtx = detail?.advisorContext;
  const headerTitle = advisorCtx?.displayTitle ?? "Asesor";
  const needsRoleDescription = Boolean(advisorCtx?.needsRoleDescription);

  const displayMessages = useMemo(() => {
    if (ghostMode) return ghostMessages;
    return detail?.messages.filter((m) => m.role !== "system") ?? [];
  }, [ghostMode, ghostMessages, detail?.messages]);

  useEffect(() => {
    if (!session) return;
    if (conversationId) return;
    if (items[0]) {
      navigate(`/chat/${items[0].id}`, { replace: true, state: location.state });
    }
  }, [conversationId, items, location.state, navigate, session]);

  useEffect(() => {
    setGhostMessages([]);
  }, [conversationId]);

  useEffect(() => {
    if (!session || !conversationId) return;
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const next = await fetchConversation(session.ownerId, conversationId);
        if (cancelled) return;
        setDetail(next);
        setTitleDraft(next.title);
        const att = next.attachment ?? null;
        setAttachment(att);
        setDocOpen(Boolean(att));
      } catch (err) {
        if (!cancelled) {
          setDetail(null);
          setAttachment(null);
          setError(err instanceof Error ? err.message : "No se pudo abrir el hilo.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, session]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [displayMessages.length, needsRoleDescription, busy]);

  async function send(question: string) {
    if (!session || !conversationId || needsRoleDescription) return;
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setDraft("");

    try {
      if (ghostMode) {
        const userMsg: ConversationMessage = {
          id: newLocalId(),
          role: "user",
          content: text,
          advisorId: null,
          modelUsed: null,
          createdAt: new Date().toISOString(),
        };
        const prior = [...ghostMessages];
        setGhostMessages((cur) => [...cur, userMsg]);
        const { answer } = await sendEphemeralMessage({
          ownerId: session.ownerId,
          profileId: session.profileId,
          conversationId,
          question: text,
          priorTurns: prior.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          documentId: attachment?.documentId ?? getDocumentId(session.ownerId),
        });
        const assistantMsg: ConversationMessage = {
          id: newLocalId(),
          role: "assistant",
          content: answer,
          advisorId: advisorCtx?.advisorId ?? null,
          modelUsed: null,
          createdAt: new Date().toISOString(),
        };
        setGhostMessages((cur) => [...cur, assistantMsg]);
      } else {
        const next = await sendConversationMessage({
          ownerId: session.ownerId,
          profileId: session.profileId,
          conversationId,
          question: text,
          documentId: attachment?.documentId ?? getDocumentId(session.ownerId),
          advisorId: detail?.advisorContext?.advisorId,
        });
        setDetail(next);
        setTitleDraft(next.title);
        if (next.attachment) setAttachment(next.attachment);
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar.");
      setDraft(text);
      if (ghostMode) {
        setGhostMessages((cur) => cur.filter((m) => m.content !== text || m.role !== "user"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function regenerateUserMessage(messageId: string, newText: string) {
    if (!session || !conversationId || !newText.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (ghostMode) {
        const idx = ghostMessages.findIndex((m) => m.id === messageId);
        if (idx < 0) return;
        const prior = ghostMessages.slice(0, idx);
        const userMsg: ConversationMessage = {
          id: newLocalId(),
          role: "user",
          content: newText.trim(),
          advisorId: null,
          modelUsed: null,
          createdAt: new Date().toISOString(),
        };
        const { answer } = await sendEphemeralMessage({
          ownerId: session.ownerId,
          profileId: session.profileId,
          conversationId,
          question: newText.trim(),
          priorTurns: prior.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          documentId: attachment?.documentId ?? getDocumentId(session.ownerId),
        });
        const assistantMsg: ConversationMessage = {
          id: newLocalId(),
          role: "assistant",
          content: answer,
          advisorId: advisorCtx?.advisorId ?? null,
          modelUsed: null,
          createdAt: new Date().toISOString(),
        };
        setGhostMessages([...prior, userMsg, assistantMsg]);
      } else {
        const next = await regenerateConversationMessage({
          ownerId: session.ownerId,
          profileId: session.profileId,
          conversationId,
          messageId,
          question: newText.trim(),
          documentId: attachment?.documentId ?? getDocumentId(session.ownerId),
        });
        setDetail(next);
        setTitleDraft(next.title);
        if (next.attachment) setAttachment(next.attachment);
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo regenerar.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const pending = (location.state as LocationState)?.pendingQuestion?.trim();
    if (!pending || !conversationId || !session || needsRoleDescription) return;
    const key = `${conversationId}:${pending}`;
    if (sentPendingKeys.has(key)) return;
    sentPendingKeys.add(key);
    navigate(location.pathname, { replace: true, state: null });
    void send(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, location.state, session, needsRoleDescription]);

  async function commitTitle() {
    if (!conversationId || !detail || ghostMode) return;
    const next = titleDraft.trim();
    if (!next || next === detail.title) {
      setTitleDraft(detail.title);
      return;
    }
    try {
      await renameThread(conversationId, next);
      setDetail({ ...detail, title: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo renombrar.");
      setTitleDraft(detail.title);
    }
  }

  async function onAttach(file: File) {
    if (!session || !conversationId || ghostMode) return;
    setAttachBusy(true);
    setError(null);
    try {
      const meta = await attachConversationFile({
        ownerId: session.ownerId,
        conversationId,
        file,
      });
      setAttachment(meta);
      setDocOpen(true);
      const next = await fetchConversation(session.ownerId, conversationId);
      setDetail(next);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo adjuntar.");
    } finally {
      setAttachBusy(false);
    }
  }

  async function saveCustomRole() {
    if (!session || !conversationId || !advisorCtx?.railNodeId) return;
    const text = roleDraft.trim();
    if (!text || roleBusy) return;
    setRoleBusy(true);
    setError(null);
    try {
      await patchRailNodeApi({
        ownerId: session.ownerId,
        nodeId: advisorCtx.railNodeId,
        customRole: text,
      });
      const next = await fetchConversation(session.ownerId, conversationId);
      setDetail(next);
      setRoleDraft("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el rol.");
    } finally {
      setRoleBusy(false);
    }
  }

  function toggleGhostMode() {
    if (ghostMode && ghostMessages.length > 0) {
      const ok = window.confirm(
        "¿Salir del chat temporal? Los mensajes de esta sesión no se guardarán.",
      );
      if (!ok) return;
    }
    const next = !ghostMode;
    setGhostMode(next);
    sessionStorage.setItem(GHOST_MODE_KEY, next ? "1" : "0");
    setGhostMessages([]);
    setError(null);
  }

  return (
    <>
      <header className="page-header chat-header">
        <div>
          <div className="advisor-name-row">
            <span className="brand-mark sm" />
            <h1 className="serif advisor-title">{headerTitle}</h1>
          </div>
          {ghostMode && (
            <div className="ghost-mode-banner">
              Chat temporal — no se guarda al salir de esta ventana
            </div>
          )}
          <div className="mono meta-muted thread-sub">
            <input
              className="thread-title-input"
              value={ghostMode ? "Chat temporal" : titleDraft}
              aria-label="Título del hilo"
              readOnly={ghostMode}
              disabled={ghostMode}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => void commitTitle()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
            />
            {attachment && (
              <span className="thread-attach-chip">
                · {attachment.fileName}
                {!docOpen && (
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => setDocOpen(true)}
                  >
                    mostrar
                  </button>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="chat-header-meta">
          <span className="mono meta-steel chat-header-date">
            {detail
              ? formatWhen(detail.lastActivityAt, session?.timezone ?? "America/Costa_Rica")
              : "—"}
          </span>
          <button
            type="button"
            className={`ghost-mode-btn ${ghostMode ? "is-active" : ""}`}
            title={
              ghostMode
                ? "Chat temporal activo — no se guarda al salir"
                : "Activar chat temporal (no se guarda)"
            }
            aria-label={
              ghostMode ? "Desactivar chat temporal" : "Activar chat temporal"
            }
            aria-pressed={ghostMode}
            onClick={toggleGhostMode}
          >
            <GhostIcon className="ghost-mode-icon" />
          </button>
        </div>
      </header>

      <div className={`chat-layout ${showDoc ? "is-1b" : "is-1a"}`}>
        {showDoc && session && attachment && (
          <DocumentPane
            documentId={attachment.documentId}
            ownerId={session.ownerId}
            fileName={attachment.fileName}
            mimeType={attachment.mimeType}
            onClose={() => setDocOpen(false)}
          />
        )}

        <div className="chat-layout-main">
          <div className="page-body chat-body" ref={bodyRef}>
            {error && <div className="inline-error">{error}</div>}
            {needsRoleDescription && (
              <div className="custom-advisor-onboarding">
                <h2 className="serif">Asesor personalizado</h2>
                <p>
                  Antes de chatear con <strong>{headerTitle}</strong>, contame qué
                  querés que haga este asesor: su especialidad, tono y qué temas debe
                  cubrir (o evitar).
                </p>
                <textarea
                  className="composer-input"
                  rows={5}
                  value={roleDraft}
                  placeholder="Ej.: Estratega de expansión regional..."
                  disabled={roleBusy}
                  onChange={(e) => setRoleDraft(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={roleBusy || !roleDraft.trim()}
                  onClick={() => void saveCustomRole()}
                >
                  {roleBusy ? "Guardando…" : "Guardar y empezar"}
                </button>
              </div>
            )}
            {!needsRoleDescription &&
              displayMessages.length === 0 &&
              !busy && (
                <p className="empty-thread">
                  {ghostMode
                    ? `Chat temporal con ${headerTitle}. Nada de esto se guardará.`
                    : attachment
                      ? "Documento a la izquierda. Preguntale al asesor sobre él."
                      : `Este hilo está vacío. Preguntale a ${headerTitle}.`}
                </p>
              )}
            {!needsRoleDescription &&
              displayMessages.map((m) => (
                <ChatMessageBlock
                  key={m.id}
                  message={m}
                  ownerName={session?.ownerName ?? "Abraham"}
                  timezone={session?.timezone ?? "America/Costa_Rica"}
                  advisorName={headerTitle}
                  editable={m.role === "user"}
                  busy={busy}
                  onRegenerate={regenerateUserMessage}
                />
              ))}
            {busy && (
              <div className="advisor-msg">
                <div className="msg-meta">
                  <span className="brand-mark xs" />
                  <span className="fw600">{headerTitle}</span>
                  <span className="mono meta-muted">escribiendo…</span>
                </div>
              </div>
            )}
          </div>

          {!needsRoleDescription && (
            <div className="chat-composer-wrap">
              <form
                className="chat-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(draft);
                }}
              >
                <div className="composer-field tall">
                  <textarea
                    className="composer-input"
                    name="q"
                    rows={2}
                    value={draft}
                    placeholder={
                      ghostMode
                        ? `Pregunta temporal a ${headerTitle}…`
                        : attachment
                          ? "Preguntá sobre el documento adjunto…"
                          : `Preguntale a ${headerTitle}…`
                    }
                    disabled={busy || !conversationId}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send(draft);
                      }
                    }}
                  />
                </div>
                <div className="composer-foot">
                  <div className="composer-hint">
                    {!ghostMode && (
                      <>
                        <button
                          type="button"
                          className="attach-btn"
                          title="Adjuntar PDF o imagen"
                          disabled={attachBusy || busy || !conversationId}
                          onClick={() => fileRef.current?.click()}
                        >
                          +
                        </button>
                        <input
                          ref={fileRef}
                          type="file"
                          accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                          hidden
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) void onAttach(file);
                          }}
                        />
                      </>
                    )}
                    <span className="mono meta-muted">
                      {attachBusy
                        ? "Subiendo…"
                        : ghostMode
                          ? "Modo temporal · no se guarda"
                          : showDoc
                            ? "Vista 1b · documento a la par"
                            : "Habla con un asesor a la vez"}
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={busy || !draft.trim() || !conversationId}
                  >
                    Enviar
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
