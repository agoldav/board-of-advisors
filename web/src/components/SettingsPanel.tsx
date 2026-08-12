import { useTheme, type Theme } from "../theme";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SettingsPanel({ open, onClose }: Props) {
  const { theme, setTheme } = useTheme();

  if (!open) return null;

  return (
    <div className="settings-backdrop" onClick={onClose} role="presentation">
      <div
        className="settings-panel"
        role="dialog"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-head">
          <div className="serif settings-title">Settings</div>
          <button type="button" className="dismiss" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="settings-section">
          <div className="mono tiny upper steel">Apariencia</div>
          <div className="theme-options">
            {(
              [
                { id: "light", label: "Claro" },
                { id: "dark", label: "Oscuro" },
              ] as { id: Theme; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`theme-option ${theme === opt.id ? "is-active" : ""}`}
                onClick={() => setTheme(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section muted-block">
          <div className="mono tiny upper steel">Cuenta</div>
          <div className="settings-line">Siscon S.R.L.</div>
          <div className="settings-line muted">Abraham · Goldgewicht - Gerente</div>
        </div>
      </div>
    </div>
  );
}
