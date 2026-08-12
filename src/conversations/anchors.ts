/**
 * Paragraph-anchored threads (Pending item 2).
 * Stored as a system message in the conversation so we do not alter schema 0001.
 */

export const ANCHOR_PREFIX = "__boa_anchor_v1__";

export type ParagraphAnchor = {
  kind: "paragraph";
  sectionKey: string;
  sectionTitle: string;
  excerpt: string;
  /** Conversation that owns the source reading/chat (optional). */
  parentConversationId?: string;
  source?: "first_reading" | "chat";
};

export function serializeAnchor(anchor: ParagraphAnchor): string {
  return `${ANCHOR_PREFIX}\n${JSON.stringify(anchor)}`;
}

export function parseAnchor(content: string): ParagraphAnchor | null {
  if (!content.startsWith(ANCHOR_PREFIX)) return null;
  const raw = content.slice(ANCHOR_PREFIX.length).trim();
  try {
    const obj = JSON.parse(raw) as Partial<ParagraphAnchor>;
    if (obj.kind !== "paragraph") return null;
    if (typeof obj.sectionKey !== "string" || !obj.sectionKey.trim()) return null;
    if (typeof obj.excerpt !== "string" || !obj.excerpt.trim()) return null;
    const sectionTitle =
      typeof obj.sectionTitle === "string" && obj.sectionTitle.trim()
        ? obj.sectionTitle.trim()
        : obj.sectionKey;
    const out: ParagraphAnchor = {
      kind: "paragraph",
      sectionKey: obj.sectionKey.trim(),
      sectionTitle,
      excerpt: obj.excerpt.trim(),
    };
    if (typeof obj.parentConversationId === "string" && obj.parentConversationId.trim()) {
      out.parentConversationId = obj.parentConversationId.trim();
    }
    if (obj.source === "first_reading" || obj.source === "chat") {
      out.source = obj.source;
    }
    return out;
  } catch {
    return null;
  }
}

export function paragraphThreadTitle(sectionTitle: string): string {
  const t = sectionTitle.trim() || "párrafo";
  return `Sobre: ${t}`;
}

/** Prompt sent to the model; the short user question is stored separately. */
export function buildParagraphModelPrompt(args: {
  anchor: ParagraphAnchor;
  question: string;
  priorTurns: Array<{ role: "user" | "assistant"; content: string }>;
}): string {
  const history =
    args.priorTurns.length === 0
      ? ""
      : "\n\nConversación previa sobre este párrafo:\n" +
        args.priorTurns
          .map((t) =>
            t.role === "user"
              ? `Dueño: ${t.content}`
              : `Asesor: ${t.content}`,
          )
          .join("\n\n");

  return (
    "El dueño comenta un párrafo concreto. Respondé solo sobre ese párrafo y su " +
    "contexto; no inventes cifras que no estén en el extracto.\n\n" +
    `Sección: ${args.anchor.sectionTitle}\n` +
    "Párrafo:\n\"\"\"\n" +
    `${args.anchor.excerpt}\n` +
    `\"\"\"${history}\n\n` +
    `Pregunta nueva del dueño:\n${args.question}`
  );
}
