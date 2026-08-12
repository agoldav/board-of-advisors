import { useState } from "react";

type Props = {
  eyebrow: string;
  placeholder: string;
  onClose: () => void;
  onSubmit: (text: string) => void | Promise<void>;
  overdue?: boolean;
  busy?: boolean;
  error?: string | null;
};

export function InlineComposer({
  eyebrow,
  placeholder,
  onClose,
  onSubmit,
  overdue,
  busy,
  error,
}: Props) {
  const [draft, setDraft] = useState("");

  return (
    <form
      className={`inline-composer rise-fast ${overdue ? "is-overdue" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        const text = draft.trim();
        if (!text || busy) return;
        void (async () => {
          await onSubmit(text);
          setDraft("");
        })();
      }}
    >
      <div className="composer-head">
        <div className="composer-eyebrow">
          {!overdue && <span className="brand-mark xs" />}
          <span className="mono tiny upper">{eyebrow}</span>
        </div>
        <button type="button" className="dismiss" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>
      <div className="composer-field">
        <textarea
          className="composer-input"
          rows={2}
          value={draft}
          placeholder={placeholder}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
      </div>
      {error && <div className="inline-error composer-error">{error}</div>}
      <div className="composer-foot">
        <div className="composer-hint">
          <button type="button" className="attach-btn" title="Adjuntar archivo" disabled>
            +
          </button>
          <span className="mono meta-muted">El Asesor Financiero responde en el hilo</span>
        </div>
        <div className="action-btns">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary sm"
            disabled={busy || !draft.trim()}
          >
            {busy ? "…" : "Enviar"}
          </button>
        </div>
      </div>
    </form>
  );
}
