/**
 * Chat threads in the app database (D-039). Create / list / get / delete,
 * plus optional JSON export/import. Scoped by owner_id (D-030).
 */
import { getPool, withTransaction } from "../db/pool.js";
import {
  parseConversationExport,
  serializeConversationExport,
  titleFromQuestion,
  type ConversationExport,
  type ExportedMessage,
} from "./export.js";

export class ConversationNotFoundError extends Error {
  constructor(id: string) {
    super(`Conversation ${id} not found.`);
    this.name = "ConversationNotFoundError";
  }
}

export class CannotDeleteLastConversationError extends Error {
  constructor() {
    super("No se puede borrar el último hilo. Creá otro antes de borrar este.");
    this.name = "CannotDeleteLastConversationError";
  }
}

export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  lastActivityAt: string;
  messageCount: number;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  advisorId: string | null;
  modelUsed: string | null;
  createdAt: string;
};

export type ConversationDetail = ConversationSummary & {
  messages: ConversationMessage[];
};

const DEFAULT_TITLE = "Nuevo hilo";

function displayTitle(title: string | null): string {
  const t = title?.trim();
  return t ? t : DEFAULT_TITLE;
}

export async function listConversations(
  ownerId: string,
): Promise<ConversationSummary[]> {
  const { rows } = await getPool().query<{
    id: string;
    title: string | null;
    created_at: Date;
    last_activity_at: Date;
    message_count: string;
  }>(
    `SELECT c.id, c.title, c.created_at,
            COALESCE(m.last_at, c.created_at) AS last_activity_at,
            COALESCE(m.message_count, 0)::text AS message_count
       FROM conversations c
       LEFT JOIN (
         SELECT conversation_id, MAX(created_at) AS last_at, COUNT(*)::int AS message_count
           FROM messages
          WHERE owner_id = $1
          GROUP BY conversation_id
       ) m ON m.conversation_id = c.id
      WHERE c.owner_id = $1
      ORDER BY last_activity_at DESC, c.created_at DESC`,
    [ownerId],
  );
  return rows.map((row) => ({
    id: row.id,
    title: displayTitle(row.title),
    createdAt: row.created_at.toISOString(),
    lastActivityAt: row.last_activity_at.toISOString(),
    messageCount: Number(row.message_count),
  }));
}

export async function createConversation(args: {
  ownerId: string;
  title?: string;
}): Promise<ConversationSummary> {
  const title = args.title?.trim() || DEFAULT_TITLE;
  const { rows } = await getPool().query<{
    id: string;
    title: string | null;
    created_at: Date;
  }>(
    `INSERT INTO conversations (owner_id, title) VALUES ($1, $2)
     RETURNING id, title, created_at`,
    [args.ownerId, title],
  );
  const row = rows[0]!;
  return {
    id: row.id,
    title: displayTitle(row.title),
    createdAt: row.created_at.toISOString(),
    lastActivityAt: row.created_at.toISOString(),
    messageCount: 0,
  };
}

export async function getConversation(
  ownerId: string,
  conversationId: string,
): Promise<ConversationDetail> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    title: string | null;
    created_at: Date;
  }>(
    `SELECT id, title, created_at
       FROM conversations
      WHERE id = $1 AND owner_id = $2`,
    [conversationId, ownerId],
  );
  const conv = rows[0];
  if (!conv) throw new ConversationNotFoundError(conversationId);

  const { rows: messages } = await pool.query<{
    id: string;
    role: ConversationMessage["role"];
    content: string;
    advisor_id: string | null;
    model_used: string | null;
    created_at: Date;
  }>(
    `SELECT id, role, content, advisor_id, model_used, created_at
       FROM messages
      WHERE conversation_id = $1 AND owner_id = $2
      ORDER BY created_at ASC, id ASC`,
    [conversationId, ownerId],
  );

  const last = messages[messages.length - 1];
  return {
    id: conv.id,
    title: displayTitle(conv.title),
    createdAt: conv.created_at.toISOString(),
    lastActivityAt: (last?.created_at ?? conv.created_at).toISOString(),
    messageCount: messages.length,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      advisorId: m.advisor_id,
      modelUsed: m.model_used,
      createdAt: m.created_at.toISOString(),
    })),
  };
}

export async function renameConversation(args: {
  ownerId: string;
  conversationId: string;
  title: string;
}): Promise<ConversationSummary> {
  const title = args.title.trim() || DEFAULT_TITLE;
  const { rows } = await getPool().query<{
    id: string;
    title: string | null;
    created_at: Date;
  }>(
    `UPDATE conversations
        SET title = $1
      WHERE id = $2 AND owner_id = $3
      RETURNING id, title, created_at`,
    [title, args.conversationId, args.ownerId],
  );
  if (!rows[0]) throw new ConversationNotFoundError(args.conversationId);
  const detail = await getConversation(args.ownerId, args.conversationId);
  return {
    id: detail.id,
    title: detail.title,
    createdAt: detail.createdAt,
    lastActivityAt: detail.lastActivityAt,
    messageCount: detail.messageCount,
  };
}

export async function deleteConversation(args: {
  ownerId: string;
  conversationId: string;
}): Promise<void> {
  await withTransaction(async (client) => {
    const { rows: owned } = await client.query<{ id: string }>(
      `SELECT id FROM conversations WHERE owner_id = $1 FOR UPDATE`,
      [args.ownerId],
    );
    if (!owned.some((r) => r.id === args.conversationId)) {
      throw new ConversationNotFoundError(args.conversationId);
    }
    if (owned.length <= 1) {
      throw new CannotDeleteLastConversationError();
    }

    await client.query(
      `DELETE FROM conversations WHERE id = $1 AND owner_id = $2`,
      [args.conversationId, args.ownerId],
    );
  });
}

export async function exportConversation(
  ownerId: string,
  conversationId: string,
): Promise<ConversationExport> {
  const detail = await getConversation(ownerId, conversationId);
  return serializeConversationExport({
    title: detail.title,
    createdAt: detail.createdAt,
    messages: detail.messages.map(
      (m): ExportedMessage => ({
        role: m.role,
        content: m.content,
        advisorId: m.advisorId,
        modelUsed: m.modelUsed,
        createdAt: m.createdAt,
      }),
    ),
  });
}

export async function importConversation(args: {
  ownerId: string;
  payload: unknown;
}): Promise<ConversationDetail> {
  const parsed = parseConversationExport(args.payload);
  const importedTitle = parsed.conversation.title.endsWith(" (importado)")
    ? parsed.conversation.title
    : `${parsed.conversation.title} (importado)`;

  const conversationId = await withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO conversations (owner_id, title, created_at)
       VALUES ($1, $2, $3::timestamptz)
       RETURNING id`,
      [args.ownerId, importedTitle, parsed.conversation.createdAt],
    );
    const id = rows[0]!.id;

    for (const m of parsed.conversation.messages) {
      await client.query(
        `INSERT INTO messages
           (owner_id, conversation_id, role, content, advisor_id, model_used, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)`,
        [
          args.ownerId,
          id,
          m.role,
          m.content,
          m.advisorId,
          m.modelUsed,
          m.createdAt,
        ],
      );
    }
    return id;
  });
  return getConversation(args.ownerId, conversationId);
}

export async function maybeAutotitle(args: {
  ownerId: string;
  conversationId: string;
  question: string;
}): Promise<void> {
  const { rows } = await getPool().query<{ title: string | null; n: string }>(
    `SELECT c.title, COUNT(m.id)::text AS n
       FROM conversations c
       LEFT JOIN messages m
         ON m.conversation_id = c.id AND m.owner_id = c.owner_id
      WHERE c.id = $1 AND c.owner_id = $2
      GROUP BY c.id, c.title`,
    [args.conversationId, args.ownerId],
  );
  const row = rows[0];
  if (!row) return;
  const current = displayTitle(row.title);
  const userMessages = Number(row.n);
  if (current !== DEFAULT_TITLE) return;
  // After askAdvisor persists the pair, n >= 2. Title if still the placeholder.
  if (userMessages === 0) return;
  await getPool().query(
    `UPDATE conversations SET title = $1 WHERE id = $2 AND owner_id = $3 AND title = $4`,
    [titleFromQuestion(args.question), args.conversationId, args.ownerId, DEFAULT_TITLE],
  );
}

export { titleFromQuestion };
