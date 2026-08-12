import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  acceptCommitment,
  ensureClientSession,
  ensureParagraphThread,
  fetchConfirmation,
  formatUsd,
  getDocumentId,
  sendConversationMessage,
  streamFirstReading,
  type ConversationDetail,
  type ConversationMessage,
  type FigureRow,
} from "../api/client";
import { InlineComposer } from "../components/InlineComposer";
import { useConversations } from "../conversations/context";
import { composition } from "../data/fixtures";

type SectionMeta = {
  id: string;
  match: RegExp;
  figure: string;
  caption: string;
  derived?: string;
  /** Which statement sections to show in the table panel. */
  tableSections: FigureRow["statementSection"][];
  chart?: boolean;
};

const SECTION_META: SectionMeta[] = [
  {
    id: "lede",
    match: /^$/,
    figure: "47,000",
    caption: "Utilidad que no está en caja",
    tableSections: ["assets", "liabilities", "equity"],
    chart: true,
  },
  {
    id: "cobros",
    match: /^cobros$/i,
    figure: "10,000",
    caption: "Cuentas por cobrar",
    derived: "≈ 8 días de venta",
    tableSections: ["assets"],
  },
  {
    id: "inventario",
    match: /^inventario$/i,
    figure: "18,400",
    caption: "Inventario de materiales",
    derived: "30% de los activos",
    tableSections: ["assets"],
  },
  {
    id: "exposicion",
    match: /^exposici[oó]n$/i,
    figure: "16,800",
    caption: "Deuda + impuestos",
    derived: "5.6× la caja disponible",
    tableSections: ["liabilities", "assets"],
  },
  {
    id: "pregunta",
    match: /^lo que necesito saber$/i,
    figure: "",
    caption: "",
    tableSections: ["assets"],
  },
  {
    id: "recomendacion",
    match: /^recomendaci[oó]n$/i,
    figure: "",
    caption: "",
    tableSections: [],
  },
];

type ReadingSection = {
  id: string;
  title: string | null;
  prose: string;
  meta: SectionMeta;
};

type AsideKind = "figure" | "table" | "chart";

function slugTitle(title: string | null): SectionMeta {
  if (!title) return SECTION_META[0]!;
  const found = SECTION_META.find((m) => m.id !== "lede" && m.match.test(title.trim()));
  return found ?? SECTION_META[0]!;
}

function parseSections(text: string): ReadingSection[] {
  const lines = text.split("\n");
  const sections: ReadingSection[] = [];
  let currentTitle: string | null = null;
  let buf: string[] = [];

  const push = () => {
    const prose = buf.join("\n").trim();
    if (!prose && !currentTitle) return;
    const meta = slugTitle(currentTitle);
    sections.push({
      id: meta.id === "lede" && sections.length ? `sec-${sections.length}` : meta.id,
      title: currentTitle,
      prose,
      meta,
    });
    buf = [];
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      push();
      currentTitle = line.slice(3).trim();
    } else {
      buf.push(line);
    }
  }
  push();
  return sections;
}

function renderProseHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const escaped = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      if (!line.trim()) return "<br/>";
      return `<p>${escaped.replace(
        /(\d[\d,]*(?:\.\d+)?)/g,
        '<span class="mono">$1</span>',
      )}</p>`;
    })
    .join("");
}

function filterFigures(
  figures: FigureRow[],
  sections: FigureRow["statementSection"][],
  sectionId: string,
): FigureRow[] {
  const inSections = figures.filter((f) => sections.includes(f.statementSection));
  if (sectionId === "cobros") {
    return inSections.filter((f) => /cobrar|receivable/i.test(f.lineItem));
  }
  if (sectionId === "inventario") {
    return inSections.filter((f) => /inventario|material/i.test(f.lineItem));
  }
  if (sectionId === "exposicion") {
    return inSections.filter((f) =>
      /pr[eé]stamo|impuesto|efectivo|caja|banco/i.test(f.lineItem),
    );
  }
  if (sectionId === "lede") {
    return inSections.filter((f) =>
      /efectivo|cobrar|inventario|pr[eé]stamo|impuesto|utilidad/i.test(f.lineItem),
    );
  }
  return inSections.slice(0, 8);
}

export function FirstReadingPage() {
  const navigate = useNavigate();
  const { refresh: refreshThreads } = useConversations();
  const [reading, setReading] = useState("");
  const [figures, setFigures] = useState<FigureRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [recommendationId, setRecommendationId] = useState<string | null>(null);
  const [commitmentText, setCommitmentText] = useState(
    "Llamar a los 3 clientes con facturas > 30 días antes del viernes.",
  );
  const [dueDate, setDueDate] = useState("2026-08-21");
  const [activeSection, setActiveSection] = useState("lede");
  const [asideKind, setAsideKind] = useState<AsideKind>("figure");
  const [asideOpen, setAsideOpen] = useState(true);
  const [commentOpen, setCommentOpen] = useState(false);
  const [parentConversationId, setParentConversationId] = useState<string | null>(
    null,
  );
  const [paragraphThread, setParagraphThread] = useState<ConversationDetail | null>(
    null,
  );
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setBusy(true);
        setError(null);
        const session = await ensureClientSession();
        if (!cancelled) setParentConversationId(session.conversationId);
        const documentId = getDocumentId(session.ownerId);
        if (!documentId) {
          navigate("/cifras");
          return;
        }

        try {
          const conf = await fetchConfirmation(session.ownerId, documentId);
          if (!cancelled) setFigures(conf.figures);
        } catch {
          /* figures optional for aside tables */
        }

        const done = await streamFirstReading({
          ownerId: session.ownerId,
          profileId: session.profileId,
          conversationId: session.conversationId,
          documentId,
          onDelta: (chunk) => {
            if (!cancelled) setReading((prev) => prev + chunk);
          },
        });
        if (cancelled) return;
        setReading(done.reading);
        setRecommendationId(done.recommendationId);
        setCommitmentText(done.suggestedCommitment.text);
        setDueDate(done.suggestedCommitment.dueDate);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Falló la primera lectura");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const sections = useMemo(() => parseSections(reading), [reading]);

  const active = useMemo(() => {
    return sections.find((s) => s.id === activeSection) ?? sections[0] ?? null;
  }, [sections, activeSection]);

  const tableRows = useMemo(() => {
    if (!active) return [];
    return filterFigures(figures, active.meta.tableSections, active.meta.id);
  }, [active, figures]);

  const visibleThreadMessages = useMemo(() => {
    if (!paragraphThread) return [] as ConversationMessage[];
    return paragraphThread.messages.filter(
      (m) => m.role === "user" || m.role === "assistant",
    );
  }, [paragraphThread]);

  async function loadParagraphThread(sec: ReadingSection) {
    const session = await ensureClientSession();
    const excerpt = sec.prose.trim();
    if (!excerpt) return;
    const item = await ensureParagraphThread({
      ownerId: session.ownerId,
      sectionKey: sec.id,
      sectionTitle: sec.title ?? "Introducción",
      excerpt,
      parentConversationId: parentConversationId ?? session.conversationId,
      source: "first_reading",
    });
    setParagraphThread(item);
    await refreshThreads();
  }

  async function openAside(sectionId: string, kind: AsideKind) {
    setActiveSection(sectionId);
    setAsideKind(kind);
    setAsideOpen(true);
    setCommentOpen(true);
    setCommentError(null);
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    try {
      await loadParagraphThread(sec);
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : "No se pudo abrir el hilo del párrafo.",
      );
    }
  }

  async function onCommentSubmit(text: string) {
    if (!active) return;
    setCommentBusy(true);
    setCommentError(null);
    try {
      const session = await ensureClientSession();
      let thread = paragraphThread;
      if (!thread || thread.anchor?.sectionKey !== active.id) {
        await loadParagraphThread(active);
        thread = await ensureParagraphThread({
          ownerId: session.ownerId,
          sectionKey: active.id,
          sectionTitle: active.title ?? "Introducción",
          excerpt: active.prose.trim(),
          parentConversationId: parentConversationId ?? session.conversationId,
          source: "first_reading",
        });
      }
      const next = await sendConversationMessage({
        ownerId: session.ownerId,
        profileId: session.profileId,
        conversationId: thread.id,
        question: text,
        documentId: getDocumentId(session.ownerId),
      });
      setParagraphThread(next);
      await refreshThreads();
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : "No se pudo enviar.");
      throw err;
    } finally {
      setCommentBusy(false);
    }
  }

  async function onAccept() {
    if (!recommendationId) return;
    setBusy(true);
    setError(null);
    try {
      const session = await ensureClientSession();
      await acceptCommitment({
        ownerId: session.ownerId,
        recommendationId,
        text: commitmentText,
        dueDate,
      });
      setAccepted(true);
      navigate("/compromisos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el compromiso");
    } finally {
      setBusy(false);
    }
  }

  function formatWhen(iso: string): string {
    try {
      return new Date(iso).toLocaleString("es-CR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  return (
    <>
      <header className="page-header reading-header">
        <div className="page-header-copy">
          <div className="mono tiny upper meta-muted">Asesor Financiero · primera lectura</div>
          <h1 className="serif page-title">La utilidad creció. La caja no.</h1>
        </div>
        <div className="confirmed-pill">
          <span className="dot ok small" />
          <span className="mono meta-steel">sobre cifras confirmadas · mock LLM</span>
        </div>
      </header>

      <div className="page-body reading-body">
        {error && (
          <div className="banner banner-error">
            <span className="dot error" />
            <span className="banner-label">{error}</span>
          </div>
        )}

        <div className={`reading-split ${asideOpen ? "has-aside" : "aside-collapsed"}`}>
          <div className="reading-main">
            {busy && !reading && (
              <div className="reading-block is-lede">
                <div className="reading-prose">
                  <p className="meta-muted">Escribiendo la primera lectura…</p>
                </div>
              </div>
            )}

            {sections.map((sec) => {
              const isActive = activeSection === sec.id && asideOpen;
              const hasFigure = Boolean(sec.meta.figure);
              const hasTable = sec.meta.tableSections.length > 0;
              const hasChart = Boolean(sec.meta.chart);
              return (
                <div
                  key={sec.id}
                  className={`reading-block ${!sec.title ? "is-lede" : ""} ${
                    isActive ? "is-active-section" : ""
                  }`}
                >
                  <div className="reading-prose">
                    {sec.title && <div className="block-title">{sec.title}</div>}
                    <button
                      type="button"
                      className={`prose-hit ${isActive ? "is-selected" : ""}`}
                      onClick={() => void openAside(sec.id, hasFigure ? "figure" : "table")}
                      dangerouslySetInnerHTML={{ __html: renderProseHtml(sec.prose) }}
                    />
                    {(hasFigure || hasTable || hasChart) && (
                      <div className="evidence-toggles">
                        {hasFigure && (
                          <button
                            type="button"
                            className={`mono evidence-chip ${
                              isActive && asideKind === "figure" ? "is-on" : ""
                            }`}
                            onClick={() => void openAside(sec.id, "figure")}
                          >
                            Cifra
                          </button>
                        )}
                        {hasTable && (
                          <button
                            type="button"
                            className={`mono evidence-chip ${
                              isActive && asideKind === "table" ? "is-on" : ""
                            }`}
                            onClick={() => void openAside(sec.id, "table")}
                          >
                            Tabla
                          </button>
                        )}
                        {hasChart && (
                          <button
                            type="button"
                            className={`mono evidence-chip ${
                              isActive && asideKind === "chart" ? "is-on" : ""
                            }`}
                            onClick={() => void openAside(sec.id, "chart")}
                          >
                            Gráfica
                          </button>
                        )}
                      </div>
                    )}

                    {isActive && commentOpen && (
                      <div className="paragraph-thread">
                        {visibleThreadMessages.map((m) => (
                          <div
                            key={m.id}
                            className={
                              m.role === "user"
                                ? "owner-msg compact"
                                : "advisor-msg"
                            }
                          >
                            <div className="msg-meta">
                              {m.role === "assistant" && (
                                <span className="brand-mark xs" />
                              )}
                              <span className="fw600">
                                {m.role === "user" ? "Abraham" : "Asesor Financiero"}
                              </span>
                              <span className="mono meta-muted">
                                {formatWhen(m.createdAt)}
                              </span>
                            </div>
                            {m.content
                              .split(/\n{2,}/)
                              .map((p) => p.trim())
                              .filter(Boolean)
                              .map((p, i) => (
                                <p key={i}>{p}</p>
                              ))}
                          </div>
                        ))}
                        <InlineComposer
                          eyebrow={`Sobre este párrafo · ${sec.title ?? "Introducción"}`}
                          placeholder={
                            sec.meta.caption
                              ? `Pregunta o comenta sobre ${sec.meta.caption.toLowerCase()}…`
                              : "Pregunta o comenta sobre este párrafo…"
                          }
                          busy={commentBusy}
                          error={commentError}
                          onClose={() => {
                            setCommentOpen(false);
                            setCommentError(null);
                          }}
                          onSubmit={onCommentSubmit}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {asideOpen && active && (
            <aside className="reading-aside rise" aria-label="Datos del párrafo">
              <div className="aside-head">
                <div className="mono tiny upper meta-muted">
                  {active.title ?? "Introducción"} ·{" "}
                  {asideKind === "figure"
                    ? "cifra"
                    : asideKind === "table"
                      ? "tabla"
                      : "gráfica"}
                </div>
                <button
                  type="button"
                  className="mono aside-close"
                  onClick={() => setAsideOpen(false)}
                  aria-label="Cerrar panel"
                >
                  cerrar
                </button>
              </div>

              {asideKind === "figure" && active.meta.figure && (
                <div className="reading-figure aside-figure">
                  <div className="mono figure-lg">{active.meta.figure}</div>
                  <div className="mono tiny upper meta-muted">{active.meta.caption}</div>
                  {active.meta.derived && (
                    <div className="derived">{active.meta.derived}</div>
                  )}
                </div>
              )}

              {asideKind === "table" && (
                <div className="aside-table-wrap">
                  {tableRows.length === 0 ? (
                    <p className="meta-muted">No hay renglones para este párrafo.</p>
                  ) : (
                    <table className="aside-table">
                      <thead>
                        <tr>
                          <th>Renglón</th>
                          <th>USD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row) => (
                          <tr key={row.id ?? row.lineItem}>
                            <td>{row.lineItem}</td>
                            <td className="mono">{formatUsd(row.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <button
                    type="button"
                    className="mono evidence-chip aside-reopen"
                    onClick={() => void openAside(active.id, "chart")}
                    disabled={!active.meta.chart}
                    hidden={!active.meta.chart}
                  >
                    Ver gráfica
                  </button>
                </div>
              )}

              {asideKind === "chart" && (
                <div className="aside-chart">
                  <div className="mono tiny upper meta-muted chart-label">
                    Composición del ingreso
                  </div>
                  {composition.map((bar) => (
                    <div key={bar.key} className="chart-row">
                      <div className="chart-meta">
                        <span>{bar.label}</span>
                        <span className="mono">{bar.pct}%</span>
                      </div>
                      <div className="chart-track">
                        <div
                          className="chart-fill"
                          style={{ width: `${bar.pct}%`, background: bar.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {asideKind === "figure" && !active.meta.figure && (
                <p className="meta-muted">Abrí Tabla para ver los renglones de este párrafo.</p>
              )}
            </aside>
          )}

          {!asideOpen && reading && (
            <button
              type="button"
              className="mono reopen-aside"
              onClick={() => setAsideOpen(true)}
            >
              Mostrar datos →
            </button>
          )}
        </div>
      </div>

      <div className="recommendation-bar rise">
        <div className="rec-copy">
          <div className="mono tiny upper meta-muted">Recomendación</div>
          <div className="rec-action">{commitmentText}</div>
          <div className="mono accent-text due">vence {dueDate}</div>
        </div>
        <div className="action-btns">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => navigate("/compromisos")}
          >
            Ahora no
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || accepted || !recommendationId}
            onClick={() => void onAccept()}
          >
            {accepted ? "Aceptado" : "Aceptar como compromiso"}
          </button>
        </div>
      </div>
    </>
  );
}
