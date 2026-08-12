import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  confirmDoc,
  ensureClientSession,
  fetchConfirmation,
  fetchLlmStatus,
  formatUsd,
  getDocumentFileName,
  getDocumentId,
  patchFigures,
  rejectDoc,
  seedDemoDocument,
  sectionLabel,
  setDocumentFileName,
  setDocumentId,
  uploadFinancialPdf,
  type ConfirmationView,
  type FigureRow,
  type LlmStatus,
} from "../api/client";

const SECTION_ORDER: FigureRow["statementSection"][] = [
  "assets",
  "liabilities",
  "equity",
  "revenue",
  "expense",
];

function draftFrom(view: ConfirmationView): Record<string, number> {
  const map: Record<string, number> = {};
  for (const f of view.figures) {
    if (f.id) map[f.id] = f.value;
  }
  return map;
}

export function ConfirmFiguresPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<ConfirmationView | null>(null);
  const [llm, setLlm] = useState<LlmStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [dragOver, setDragOver] = useState(false);

  function applyView(next: ConfirmationView) {
    setView(next);
    setDraft(draftFrom(next));
    setEditing(false);
    if (next.fileName) setDocumentFileName(next.fileName);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setBusy(true);
        setError(null);
        const [session, status] = await Promise.all([
          ensureClientSession(),
          fetchLlmStatus(),
        ]);
        if (cancelled) return;
        setLlm(status);
        const existingId = getDocumentId(session.ownerId);
        if (!existingId) return;
        try {
          const next = await fetchConfirmation(session.ownerId, existingId);
          if (cancelled) return;
          if (next.status === "rejected") {
            setDocumentId(null);
            return;
          }
          applyView({
            ...next,
            fileName: next.fileName ?? getDocumentFileName(),
          });
          setDocumentId(next.documentId, session.ownerId);
        } catch {
          setDocumentId(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const figures = view?.figures ?? [];
    return SECTION_ORDER.map((section) => ({
      section,
      rows: figures.filter((f) => f.statementSection === section),
    })).filter((g) => g.rows.length > 0);
  }, [view]);

  const canConfirm =
    Boolean(view) &&
    view!.validation.ok &&
    (view!.status === "extracted" || view!.status === "uploaded");

  const fileName =
    view?.fileName ?? getDocumentFileName() ?? "sin archivo";
  const usingClaude = llm?.active === "anthropic";
  const sourceHint = extracting
    ? "extrayendo renglones…"
    : view
      ? view.source === "demo" || fileName === "estados_2026_jun.pdf"
        ? usingClaude
          ? "demo (sin pasar por Claude)"
          : "demo · mock"
        : usingClaude
          ? "extraído con Claude"
          : "mock extract (sin API key / LLM_PROVIDER=mock)"
      : usingClaude
        ? "Claude listo — subí un PDF"
        : "sin Claude — podés subir PDF (mock) o usar demo";

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    if (file.type && file.type !== "application/pdf") {
      setError("Solo se aceptan PDF de estados financieros.");
      return;
    }
    setBusy(true);
    setExtracting(true);
    setError(null);
    try {
      const session = await ensureClientSession();
      const next = await uploadFinancialPdf(session.ownerId, file);
      applyView(next);
      setDocumentId(next.documentId, session.ownerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo extraer el PDF");
    } finally {
      setBusy(false);
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveEdits() {
    if (!view) return;
    const session = await ensureClientSession();
    const corrections = view.figures
      .filter((f) => f.id && draft[f.id] !== undefined && draft[f.id] !== f.value)
      .map((f) => ({
        figureId: f.id!,
        value: draft[f.id!]!,
        lineItem: f.lineItem,
      }));
    if (corrections.length === 0) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await patchFigures(session.ownerId, view.documentId, corrections);
      applyView(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm() {
    if (!view) return;
    setBusy(true);
    setError(null);
    try {
      if (editing) await saveEdits();
      const session = await ensureClientSession();
      setDocumentId(view.documentId, session.ownerId);
      try {
        await confirmDoc(session.ownerId, view.documentId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (/not found/i.test(msg)) {
          setView(null);
          setDocumentId(null);
          setError(
            "La sesión se desfasó. Subí el PDF de nuevo o cargá el demo.",
          );
          return;
        }
        throw err;
      }
      navigate("/lectura");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar");
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    if (!view) return;
    setBusy(true);
    setError(null);
    try {
      const session = await ensureClientSession();
      await rejectDoc(session.ownerId, view.documentId);
      setView(null);
      setDraft({});
      setDocumentId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo rechazar");
    } finally {
      setBusy(false);
    }
  }

  async function onReloadDemo() {
    setBusy(true);
    setError(null);
    try {
      const session = await ensureClientSession();
      const next = await seedDemoDocument(session.ownerId);
      applyView(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar demo");
    } finally {
      setBusy(false);
    }
  }

  const identity = view?.validation.identity;

  return (
    <>
      <header className="page-header cifras-header">
        <div className="page-header-copy">
          <h1 className="serif page-title">Confirma lo que leí de tus estados</h1>
          <p className="page-sub">
            Sin cifras confirmadas el board no da consejo. Subí el PDF, revisá cada renglón,
            corregí lo que esté mal.
          </p>
        </div>
        <div className="page-header-meta">
          <div className="mono meta-strong">{fileName}</div>
          <div className="mono meta-muted">
            {view?.periodEnd ? `periodo hasta ${view.periodEnd}` : sourceHint}
          </div>
          <div className="cifras-header-actions">
            <button
              type="button"
              className="mono descuadre-toggle"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              subir PDF
            </button>
            <button
              type="button"
              className="mono descuadre-toggle"
              onClick={() => void onReloadDemo()}
              disabled={busy}
            >
              usar demo
            </button>
          </div>
        </div>
      </header>

      <input
        ref={fileRef}
        className="upload-input"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => void onPickFile(e.target.files?.[0])}
      />

      <div className="page-body cifras-body">
        {error && (
          <div className="banner banner-error">
            <span className="dot error" />
            <span className="banner-label">{error}</span>
          </div>
        )}

        {extracting && (
          <div className="banner banner-ok">
            <span className="banner-label">
              Extrayendo renglones del PDF… puede tardar un minuto.
            </span>
          </div>
        )}

        {!view && busy && !extracting && (
          <div className="banner banner-ok">
            <span className="banner-label">Cargando…</span>
          </div>
        )}

        {!view && !busy && (
          <button
            type="button"
            className={`upload-card ${dragOver ? "is-drag" : ""}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void onPickFile(e.dataTransfer.files?.[0]);
            }}
          >
            <div className="serif upload-title">Subí un estado financiero en PDF</div>
            <p className="upload-copy">
              {usingClaude
                ? "Claude lee todos los renglones. Después confirmás las cifras antes de cualquier consejo."
                : "Todavía no hay Claude (mock). La subida guarda el PDF; las cifras serán de ejemplo hasta que LLM_PROVIDER=anthropic."}
            </p>
            <span className="mono upload-hint">soltá el archivo aquí o hacé clic · o usá demo</span>
          </button>
        )}

        {view && identity && (
          <>
            {view.validation.ok ? (
              <div className="banner banner-ok rise">
                <span className="dot ok" />
                <span className="banner-label">La aritmética cuadra</span>
                <span className="mono banner-eq accent-text">
                  activos {formatUsd(identity.assets)} = pasivo{" "}
                  {formatUsd(identity.liabilities)} + patrimonio {formatUsd(identity.equity)}
                </span>
              </div>
            ) : (
              <div className="banner banner-error">
                <span className="dot error" />
                <span className="banner-label">
                  Los totales no cuadran por {formatUsd(Math.abs(identity.difference))}
                </span>
                <span className="mono banner-eq error-text">
                  activos {formatUsd(identity.assets)} ≠ pasivo{" "}
                  {formatUsd(identity.liabilities)} + patrimonio {formatUsd(identity.equity)}
                </span>
              </div>
            )}

            <div className="cifras-grid">
              <section className="sheet-card scroll-card">
                <div className="sheet-head">
                  <div className="sheet-title">Balance y resultados</div>
                  <div className="mono meta-muted">{sourceHint}</div>
                </div>
                {grouped.map((g) => (
                  <div key={g.section} className="sheet-section">
                    <div className="mono tiny upper meta-muted sheet-section-label">
                      {sectionLabel(g.section)}
                    </div>
                    {g.rows.map((row) => (
                      <div key={row.id ?? row.lineItem} className="line-row">
                        <div className="line-label">{row.lineItem}</div>
                        {editing && row.id ? (
                          <input
                            className="mono line-amount-input"
                            value={draft[row.id] ?? row.value}
                            onChange={(e) => {
                              const n = Number(String(e.target.value).replace(/,/g, ""));
                              if (Number.isNaN(n)) return;
                              setDraft((prev) => ({ ...prev, [row.id!]: n }));
                            }}
                          />
                        ) : (
                          <div className="mono line-amount">
                            {formatUsd(row.id ? (draft[row.id] ?? row.value) : row.value)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            </div>
          </>
        )}
      </div>

      <div className="recommendation-bar cifras-bar rise">
        <div className="rec-copy">
          <div className="mono tiny upper meta-muted">Confirmación</div>
          <div className="rec-action">
            {!view
              ? "Subí un PDF de estados financieros para empezar."
              : canConfirm
                ? "Los números cuadran. Podés confirmar y pedir la primera lectura."
                : view.status === "confirmed"
                  ? "Cifras ya confirmadas. Subí otro PDF si querés reemplazarlas."
                  : "Corregí los renglones hasta que la aritmética cuadre."}
          </div>
        </div>
        <div className="action-btns">
          <button type="button" className="btn btn-ghost" disabled={busy || !view} onClick={() => void onReject()}>
            Rechazar
          </button>
          {editing ? (
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => void saveEdits()}
            >
              Guardar correcciones
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy || !view}
              onClick={() => setEditing(true)}
            >
              Corregir
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !canConfirm}
            onClick={() => void onConfirm()}
          >
            Confirmar cifras
          </button>
        </div>
      </div>
    </>
  );
}
