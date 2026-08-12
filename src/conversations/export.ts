/**
 * Optional conversation backup (D-039). Database is the source of truth;
 * this JSON is a portable snapshot, not a watched local folder.
 */

export const CONVERSATION_EXPORT_VERSION = 1 as const;

export type ExportedMessageRole = "user" | "assistant" | "system";

export type ExportedMessage = {
  role: ExportedMessageRole;
  content: string;
  advisorId: string | null;
  modelUsed: string | null;
  createdAt: string;
};

export type ConversationExport = {
  version: typeof CONVERSATION_EXPORT_VERSION;
  exportedAt: string;
  conversation: {
    title: string;
    createdAt: string;
    messages: ExportedMessage[];
  };
};

export class InvalidConversationExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidConversationExportError";
  }
}

const ROLES = new Set<ExportedMessageRole>(["user", "assistant", "system"]);

function parseIsoDate(value: string | undefined): string {
  if (!value?.trim()) return new Date().toISOString();
  if (Number.isNaN(Date.parse(value))) {
    throw new InvalidConversationExportError("Fecha inválida en el export.");
  }
  return value;
}

export function titleFromQuestion(question: string): string {
  const line = question.trim().split(/\r?\n/, 1)[0] ?? "";
  const collapsed = line.replace(/\s+/g, " ").trim();
  if (!collapsed) return "Nuevo hilo";
  return collapsed.length > 60 ? `${collapsed.slice(0, 57).trimEnd()}…` : collapsed;
}

export function serializeConversationExport(args: {
  title: string;
  createdAt: string;
  messages: ExportedMessage[];
  exportedAt?: string;
}): ConversationExport {
  return {
    version: CONVERSATION_EXPORT_VERSION,
    exportedAt: args.exportedAt ?? new Date().toISOString(),
    conversation: {
      title: args.title,
      createdAt: args.createdAt,
      messages: args.messages,
    },
  };
}

export function parseConversationExport(raw: unknown): ConversationExport {
  if (!raw || typeof raw !== "object") {
    throw new InvalidConversationExportError("El archivo no es un JSON de hilo válido.");
  }
  const obj = raw as Record<string, unknown>;
  if (obj.version !== CONVERSATION_EXPORT_VERSION) {
    throw new InvalidConversationExportError(
      `Versión de export no soportada (se espera ${CONVERSATION_EXPORT_VERSION}).`,
    );
  }
  const conversation = obj.conversation;
  if (!conversation || typeof conversation !== "object") {
    throw new InvalidConversationExportError("Falta el objeto conversation.");
  }
  const conv = conversation as Record<string, unknown>;
  const title =
    typeof conv.title === "string" && conv.title.trim()
      ? conv.title.trim()
      : "Hilo importado";
  const createdAt = parseIsoDate(
    typeof conv.createdAt === "string" ? conv.createdAt : undefined,
  );
  if (!Array.isArray(conv.messages)) {
    throw new InvalidConversationExportError("messages debe ser un arreglo.");
  }

  const messages: ExportedMessage[] = conv.messages.map((item, i) => {
    if (!item || typeof item !== "object") {
      throw new InvalidConversationExportError(`Mensaje ${i} inválido.`);
    }
    const m = item as Record<string, unknown>;
    if (typeof m.role !== "string" || !ROLES.has(m.role as ExportedMessageRole)) {
      throw new InvalidConversationExportError(`Mensaje ${i}: role inválido.`);
    }
    if (typeof m.content !== "string" || !m.content.trim()) {
      throw new InvalidConversationExportError(`Mensaje ${i}: content vacío.`);
    }
    return {
      role: m.role as ExportedMessageRole,
      content: m.content,
      advisorId: typeof m.advisorId === "string" ? m.advisorId : null,
      modelUsed: typeof m.modelUsed === "string" ? m.modelUsed : null,
      createdAt: parseIsoDate(typeof m.createdAt === "string" ? m.createdAt : undefined),
    };
  });

  return {
    version: CONVERSATION_EXPORT_VERSION,
    exportedAt:
      typeof obj.exportedAt === "string" ? obj.exportedAt : new Date().toISOString(),
    conversation: { title, createdAt, messages },
  };
}
