type Props = {
  eyebrow: string;
  placeholder: string;
  onClose: () => void;
  overdue?: boolean;
};

export function InlineComposer({ eyebrow, placeholder, onClose, overdue }: Props) {
  return (
    <div className={`inline-composer rise-fast ${overdue ? "is-overdue" : ""}`}>
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
        <span className="placeholder">{placeholder}</span>
        <span className="text-caret" />
      </div>
      <div className="composer-foot">
        <div className="composer-hint">
          <button type="button" className="attach-btn" title="Adjuntar archivo">
            +
          </button>
          <span className="mono meta-muted">El Asesor Financiero responde en el hilo</span>
        </div>
        <div className="action-btns">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary sm">
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
