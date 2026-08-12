type Props = {
  placeholder?: string;
  onSend?: (text: string) => void;
};

export function ChatBar({
  placeholder = "Pregúntale al Asesor Financiero…",
  onSend,
}: Props) {
  return (
    <div className="chat-bar">
      <form
        className="chat-pill"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const text = String(fd.get("q") ?? "").trim();
          if (text) onSend?.(text);
          e.currentTarget.reset();
        }}
      >
        <button type="button" className="attach-btn" title="Adjuntar archivo" aria-label="Adjuntar">
          +
        </button>
        <input name="q" className="chat-input" placeholder={placeholder} autoComplete="off" />
        <button type="submit" className="btn btn-primary chat-send">
          Enviar
        </button>
      </form>
    </div>
  );
}
