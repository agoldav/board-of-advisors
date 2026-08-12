/**
 * Chat attachments (Pending item 3 — view 1b).
 * PDF / JPEG / PNG stored in documents.original_bytes without extraction.
 */
import { getPool } from "../db/pool.js";
import { insertDocument, loadDocument } from "./persistence.js";
import type { DocumentKind } from "./types.js";

export const MAX_ATTACH_BYTES = 20 * 1024 * 1024;

export class AttachUploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AttachUploadError";
  }
}

export type AttachMime = "application/pdf" | "image/jpeg" | "image/png";

const ALLOWED: Record<string, { mime: AttachMime; kind: DocumentKind }> = {
  ".pdf": { mime: "application/pdf", kind: "other" },
  ".jpg": { mime: "image/jpeg", kind: "other" },
  ".jpeg": { mime: "image/jpeg", kind: "other" },
  ".png": { mime: "image/png", kind: "other" },
};

export function parseAttachFilename(header: string | string[] | undefined): string {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw || !raw.trim()) return "adjunto.bin";
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    /* keep raw */
  }
  const base = decoded.replace(/\\/g, "/").split("/").pop() ?? decoded;
  return base.replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]+/gi, "_").slice(0, 180) || "adjunto.bin";
}

export function detectAttachType(fileName: string): {
  mime: AttachMime;
  kind: DocumentKind;
  ext: string;
} {
  const lower = fileName.toLowerCase();
  const ext = Object.keys(ALLOWED).find((e) => lower.endsWith(e));
  if (!ext) {
    throw new AttachUploadError(
      "Solo se admiten PDF, JPG o PNG para adjuntar al chat.",
      415,
    );
  }
  return { ...ALLOWED[ext]!, ext };
}

export function assertAttachBytes(bytes: Buffer, mime: AttachMime): void {
  if (!bytes.length) {
    throw new AttachUploadError("El archivo está vacío.", 400);
  }
  if (bytes.length > MAX_ATTACH_BYTES) {
    throw new AttachUploadError(
      `El archivo supera el límite de ${Math.round(MAX_ATTACH_BYTES / (1024 * 1024))} MB.`,
      413,
    );
  }
  if (mime === "application/pdf") {
    if (bytes.subarray(0, 5).toString("utf8") !== "%PDF-") {
      throw new AttachUploadError("El archivo no es un PDF válido.", 400);
    }
  } else if (mime === "image/jpeg") {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      throw new AttachUploadError("El archivo no es un JPEG válido.", 400);
    }
  } else if (mime === "image/png") {
    const sig = bytes.subarray(0, 8);
    const expected = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (!sig.equals(expected)) {
      throw new AttachUploadError("El archivo no es un PNG válido.", 400);
    }
  }
}

export type AttachmentMeta = {
  documentId: string;
  fileName: string;
  mimeType: AttachMime;
};

export const ATTACHMENT_PREFIX = "__boa_attachment_v1__";

export function serializeAttachmentMeta(meta: AttachmentMeta): string {
  return `${ATTACHMENT_PREFIX}\n${JSON.stringify(meta)}`;
}

export function parseAttachmentMeta(content: string): AttachmentMeta | null {
  if (!content.startsWith(ATTACHMENT_PREFIX)) return null;
  try {
    const obj = JSON.parse(content.slice(ATTACHMENT_PREFIX.length).trim()) as Partial<AttachmentMeta>;
    if (typeof obj.documentId !== "string" || !obj.documentId.trim()) return null;
    if (typeof obj.fileName !== "string" || !obj.fileName.trim()) return null;
    if (
      obj.mimeType !== "application/pdf" &&
      obj.mimeType !== "image/jpeg" &&
      obj.mimeType !== "image/png"
    ) {
      return null;
    }
    return {
      documentId: obj.documentId.trim(),
      fileName: obj.fileName.trim(),
      mimeType: obj.mimeType,
    };
  } catch {
    return null;
  }
}

export async function attachChatDocument(args: {
  ownerId: string;
  conversationId: string;
  bytes: Buffer;
  fileName: string;
}): Promise<AttachmentMeta> {
  const { mime, kind } = detectAttachType(args.fileName);
  assertAttachBytes(args.bytes, mime);

  const owned = await getPool().query<{ id: string }>(
    `SELECT id FROM conversations WHERE id = $1 AND owner_id = $2`,
    [args.conversationId, args.ownerId],
  );
  if (!owned.rows[0]) {
    throw new AttachUploadError("Conversation not found.", 404);
  }

  const documentId = await insertDocument({
    ownerId: args.ownerId,
    kind,
    pdfBytes: args.bytes,
    originalPath: args.fileName,
  });

  const meta: AttachmentMeta = {
    documentId,
    fileName: args.fileName,
    mimeType: mime,
  };

  await getPool().query(
    `INSERT INTO messages (owner_id, conversation_id, role, content)
     VALUES ($1, $2, 'system', $3)`,
    [args.ownerId, args.conversationId, serializeAttachmentMeta(meta)],
  );

  return meta;
}

export async function loadDocumentFile(
  ownerId: string,
  documentId: string,
): Promise<{ bytes: Buffer; fileName: string; mimeType: string } | null> {
  const doc = await loadDocument(ownerId, documentId);
  if (!doc) return null;
  const { rows } = await getPool().query<{
    original_bytes: Buffer | null;
    original_path: string | null;
  }>(
    `SELECT original_bytes, original_path
       FROM documents
      WHERE id = $1 AND owner_id = $2`,
    [documentId, ownerId],
  );
  const row = rows[0];
  if (!row?.original_bytes) return null;
  const fileName = row.original_path?.trim() || doc.originalPath || "adjunto";
  let mime = "application/octet-stream";
  try {
    mime = detectAttachType(fileName).mime;
  } catch {
    /* keep octet-stream */
  }
  return { bytes: row.original_bytes, fileName, mimeType: mime };
}

export function latestAttachmentFromMessages(
  messages: Array<{ role: string; content: string }>,
): AttachmentMeta | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role !== "system") continue;
    const parsed = parseAttachmentMeta(m.content);
    if (parsed) return parsed;
  }
  return null;
}
