import { useEffect, useState } from "react";
import { InlineComposer } from "../components/InlineComposer";
import {
  ensureClientSession,
  fetchCommitments,
  transitionCommitmentApi,
  type CommitmentItem,
} from "../api/client";

type UiStatus = "pending" | "overdue" | "done" | "postponed" | "discarded";

function toUiStatus(display: CommitmentItem["displayStatus"]): UiStatus {
  switch (display) {
    case "deferred":
      return "postponed";
    case "dismissed":
      return "discarded";
    default:
      return display;
  }
}

function dueLabel(c: CommitmentItem): string {
  const ui = toUiStatus(c.displayStatus);
  if (ui === "overdue") return `vencido · ${c.deferredTo ?? c.dueDate}`;
  if (ui === "done") return "hecho";
  if (ui === "postponed") return `pospuesto a ${c.deferredTo ?? c.dueDate}`;
  if (ui === "discarded") return "descartado";
  return `vence ${c.dueDate}`;
}

export function CommitmentsPage() {
  const [items, setItems] = useState<CommitmentItem[]>([]);
  const [expandedOverdue, setExpandedOverdue] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  async function reload() {
    const session = await ensureClientSession();
    const list = await fetchCommitments(session.ownerId);
    setItems(list);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setBusy(true);
        await reload();
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

  const overdue = items.filter((c) => toUiStatus(c.displayStatus) === "overdue");
  const pending = items.filter((c) => toUiStatus(c.displayStatus) === "pending");
  const closed = items.filter((c) =>
    ["done", "postponed", "discarded"].includes(toUiStatus(c.displayStatus)),
  );

  async function markDone(id: string) {
    const evidence = window.prompt("¿Qué se hizo? (evidencia breve)");
    if (evidence === null) return;
    try {
      const session = await ensureClientSession();
      await transitionCommitmentApi({
        ownerId: session.ownerId,
        commitmentId: id,
        to: "done",
        closedEvidence: evidence || "Hecho",
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo marcar hecho");
    }
  }

  async function postpone(id: string) {
    const date = window.prompt("Nueva fecha (YYYY-MM-DD)", "2026-07-16");
    if (!date?.trim()) return;
    try {
      const session = await ensureClientSession();
      await transitionCommitmentApi({
        ownerId: session.ownerId,
        commitmentId: id,
        to: "deferred",
        deferredTo: date.trim(),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo posponer");
    }
  }

  async function discard(id: string) {
    const reason = window.prompt("Motivo del descarte (obligatorio)");
    if (!reason?.trim()) return;
    try {
      const session = await ensureClientSession();
      await transitionCommitmentApi({
        ownerId: session.ownerId,
        commitmentId: id,
        to: "dismissed",
        dismissedReason: reason.trim(),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descartar");
    }
  }

  function renderActions(id: string) {
    return (
      <div className="action-btns">
        <button type="button" className="btn btn-ghost" onClick={() => void discard(id)}>
          Descartar
        </button>
        <button type="button" className="btn btn-outline" onClick={() => void postpone(id)}>
          Posponer
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void markDone(id)}>
          Hecho
        </button>
      </div>
    );
  }

  return (
    <>
      <header className="page-header reading-header">
        <div className="page-header-copy">
          <h1 className="serif page-title">Lo que dijiste que ibas a hacer</h1>
          <p className="page-sub">
            {busy
              ? "Cargando compromisos…"
              : `${items.length} compromiso${items.length === 1 ? "" : "s"} en la base.`}
          </p>
        </div>
      </header>

      <div className="page-body commitments-body">
        {error && (
          <div className="banner banner-error">
            <span className="dot error" />
            <span className="banner-label">{error}</span>
          </div>
        )}

        {!busy && items.length === 0 && (
          <p className="meta-muted">
            Todavía no hay compromisos. Confirmá cifras y aceptá la recomendación de la primera
            lectura.
          </p>
        )}

        {overdue.length > 0 && (
          <>
            <div className="group-head error">
              <span className="mono tiny upper">Vencido</span>
              <span className="rule" />
            </div>
            {overdue.map((c) => (
              <div key={c.id} className="overdue-card rise">
                <div className="commitment-row">
                  <button
                    type="button"
                    className="commitment-main"
                    onClick={() => setExpandedOverdue((v) => !v)}
                  >
                    <div className="commitment-text fw500">{c.text}</div>
                    <div className="commitment-meta">
                      <span className="mono error-text">{dueLabel(c)}</span>
                      <span className="meta-divider overdue" />
                      <span className="meta-origin">{c.origin}</span>
                    </div>
                  </button>
                  {renderActions(c.id)}
                </div>
                {expandedOverdue && showComposer && (
                  <InlineComposer
                    eyebrow="Sobre este compromiso"
                    placeholder="Nota para el board…"
                    onClose={() => setShowComposer(false)}
                  />
                )}
              </div>
            ))}
          </>
        )}

        {pending.length > 0 && (
          <>
            <div className="group-head">
              <span className="mono tiny upper">Pendiente</span>
              <span className="rule" />
            </div>
            {pending.map((c) => (
              <div key={c.id} className="commitment-row rise">
                <div className="commitment-main">
                  <div className="commitment-text">{c.text}</div>
                  <div className="commitment-meta">
                    <span className="mono meta-steel">{dueLabel(c)}</span>
                    <span className="meta-divider" />
                    <span className="meta-origin">{c.origin}</span>
                  </div>
                </div>
                {renderActions(c.id)}
              </div>
            ))}
          </>
        )}

        {closed.length > 0 && (
          <>
            <div className="group-head">
              <span className="mono tiny upper">Cerrado</span>
              <span className="rule" />
            </div>
            {closed.map((c) => (
              <div key={c.id} className="commitment-row is-closed">
                <div className="commitment-main">
                  <div className="commitment-text">{c.text}</div>
                  <div className="commitment-meta">
                    <span className="mono meta-muted">{dueLabel(c)}</span>
                    <span className="meta-divider" />
                    <span className="meta-origin">
                      {c.closedEvidence || c.dismissedReason || c.origin}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
