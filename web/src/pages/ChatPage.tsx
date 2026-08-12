import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  fetchConversation,
  getDocumentId,
  sendConversationMessage,
  type ConversationDetail,
  type ConversationMessage,
} from "../api/client";
import { useConversations } from "../conversations/context";

type LocationState = { pendingQuestion?: string } | null;

const sentPendingKeys = new Set<string>();

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

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function MessageBlock({
  message,
  ownerName,
  timezone,
}: {
  message: ConversationMessage;
  ownerName: string;
  timezone: string;
}) {
  const at = formatWhen(message.createdAt, timezone);
  if (message.role === "user") {
    return (
      <div className="owner-msg">
        <div className="msg-meta">
          <span className="fw600">{ownerName}</span>
          <span className="mono meta-muted">{at}</span>
        </div>
        {paragraphs(message.content).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    );
  }
  return (
    <div className="advisor-msg">
      <div className="msg-meta">
        <span className="brand-mark xs" />
        <span className="fw600">Asesor Financiero</span>
        <span className="mono meta-muted">{at}</span>
      </div>
      {paragraphs(message.content).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

export function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    session,
    items,
    refresh,
    renameThread,
  } = useConversations();
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    if (conversationId) return;
    if (items[0]) {
      navigate(`/chat/${items[0].id}`, { replace: true, state: location.state });
    }
  }, [conversationId, items, location.state, navigate, session]);

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
      } catch (err) {
        if (!cancelled) {
          setDetail(null);
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
  }, [detail?.messages.length]);

  async function send(question: string) {
    if (!session || !conversationId) return;
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setDraft("");
    try {
      const next = await sendConversationMessage({
        ownerId: session.ownerId,
        profileId: session.profileId,
        conversationId,
        question: text,
        documentId: getDocumentId(session.ownerId),
      });
      setDetail(next);
      setTitleDraft(next.title);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar.");
      setDraft(text);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const pending = (location.state as LocationState)?.pendingQuestion?.trim();
    if (!pending || !conversationId || !session) return;
    const key = `${conversationId}:${pending}`;
    if (sentPendingKeys.has(key)) return;
    sentPendingKeys.add(key);
    navigate(location.pathname, { replace: true, state: null });
    void send(pending);
    // send is recreated each render; we only want this when pending arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, location.state, session]);

  async function commitTitle() {
    if (!conversationId || !detail) return;
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

  return (
    <>
      <header className="page-header chat-header">
        <div>
          <div className="advisor-name-row">
            <span className="brand-mark sm" />
            <h1 className="serif advisor-title">Asesor Financiero</h1>
            <button type="button" className="change-advisor" disabled>
              Cambiar de asesor
            </button>
          </div>
          <div className="mono meta-muted thread-sub">
            <input
              className="thread-title-input"
              value={titleDraft}
              aria-label="Título del hilo"
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => void commitTitle()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
            />
          </div>
        </div>
        <div className="mono meta-steel">
          {detail
            ? formatWhen(detail.lastActivityAt, session?.timezone ?? "America/Costa_Rica")
            : "—"}
        </div>
      </header>

      <div className="page-body chat-body" ref={bodyRef}>
        {error && <div className="inline-error">{error}</div>}
        {detail && detail.messages.length === 0 && !busy && (
          <p className="empty-thread">Este hilo está vacío. Preguntale al asesor.</p>
        )}
        {detail?.messages
          .filter((m) => m.role !== "system")
          .map((m) => (
            <MessageBlock
              key={m.id}
              message={m}
              ownerName={session?.ownerName ?? "Abraham"}
              timezone={session?.timezone ?? "America/Costa_Rica"}
            />
          ))}
        {busy && (
          <div className="advisor-msg">
            <div className="msg-meta">
              <span className="brand-mark xs" />
              <span className="fw600">Asesor Financiero</span>
              <span className="mono meta-muted">escribiendo…</span>
            </div>
          </div>
        )}
      </div>

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
              placeholder="Pregúntale al Asesor Financiero…"
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
              <button type="button" className="attach-btn" title="Adjuntar archivo" disabled>
                +
              </button>
              <span className="mono meta-muted">Habla con un asesor a la vez</span>
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
    </>
  );
}
