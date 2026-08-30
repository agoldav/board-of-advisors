import { useState } from "react";
import type { ConversationMessage } from "../api/client";
import { AdvisorMessageBody } from "../lib/formatAdvisorMessage";

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

export function ChatMessageBlock({
  message,
  ownerName,
  timezone,
  advisorName,
  editable,
  busy,
  onRegenerate,
}: {
  message: ConversationMessage;
  ownerName: string;
  timezone: string;
  advisorName: string;
  editable: boolean;
  busy: boolean;
  onRegenerate?: (messageId: string, newText: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const at = formatWhen(message.createdAt, timezone);

  if (message.role === "user") {
    return (
      <div className="owner-msg">
        <div className="msg-meta">
          <span className="fw600">{ownerName}</span>
          <span className="mono meta-muted">{at}</span>
          {editable && onRegenerate && !editing && (
            <button
              type="button"
              className="msg-edit-btn"
              disabled={busy}
              onClick={() => {
                setDraft(message.content);
                setEditing(true);
              }}
            >
              Editar
            </button>
          )}
        </div>
        {editing ? (
          <div className="msg-edit-box">
            <textarea
              className="composer-input"
              rows={3}
              value={draft}
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="msg-edit-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => setEditing(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !draft.trim()}
                onClick={() => {
                  void onRegenerate!(message.id, draft.trim()).then(() =>
                    setEditing(false),
                  );
                }}
              >
                Regenerar
              </button>
            </div>
          </div>
        ) : (
          <p className="owner-msg-text">{message.content}</p>
        )}
      </div>
    );
  }

  return (
    <div className="advisor-msg">
      <div className="msg-meta">
        <span className="brand-mark xs" />
        <span className="fw600">{advisorName}</span>
        <span className="mono meta-muted">{at}</span>
      </div>
      <AdvisorMessageBody text={message.content} />
    </div>
  );
}
