/**
 * Helpers for POST /api/documents/upload (raw PDF body + filename header).
 * No multipart library — browser sends application/pdf with X-Filename.
 */

export const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MiB — under typical Claude PDF caps

export class PdfUploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PdfUploadError";
  }
}

/** Decode X-Filename (URI-encoded UTF-8) into a safe display name. */
export function parseUploadFilename(header: string | string[] | undefined): string {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw || !raw.trim()) return "estados.pdf";
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    /* keep raw */
  }
  // Strip path segments if a client sent a full path.
  const base = decoded.replace(/\\/g, "/").split("/").pop() ?? decoded;
  const cleaned = base.replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]+/gi, "_").slice(0, 180);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

export function assertPdfBytes(bytes: Buffer): void {
  if (!bytes.length) {
    throw new PdfUploadError("El PDF está vacío.", 400);
  }
  if (bytes.length > MAX_PDF_BYTES) {
    throw new PdfUploadError(
      `El PDF supera el límite de ${Math.round(MAX_PDF_BYTES / (1024 * 1024))} MB.`,
      413,
    );
  }
  const head = bytes.subarray(0, 5).toString("utf8");
  if (head !== "%PDF-") {
    throw new PdfUploadError(
      "El archivo no es un PDF válido. Subí un balance o estado de resultados en PDF.",
      400,
    );
  }
}
