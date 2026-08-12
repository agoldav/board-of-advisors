import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_PREFIX,
  assertAttachBytes,
  detectAttachType,
  parseAttachFilename,
  parseAttachmentMeta,
  serializeAttachmentMeta,
  AttachUploadError,
} from "./attach.js";

describe("attach upload helpers", () => {
  it("parses filenames and detects types", () => {
    expect(parseAttachFilename("contrato%20junio.pdf")).toBe("contrato junio.pdf");
    expect(detectAttachType("foto.JPG").mime).toBe("image/jpeg");
    expect(detectAttachType("a.png").mime).toBe("image/png");
    expect(() => detectAttachType("x.txt")).toThrow(AttachUploadError);
  });

  it("validates magic bytes", () => {
    expect(() =>
      assertAttachBytes(Buffer.from("%PDF-1.4\n"), "application/pdf"),
    ).not.toThrow();
    expect(() =>
      assertAttachBytes(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"),
    ).not.toThrow();
    expect(() =>
      assertAttachBytes(Buffer.from("nope"), "application/pdf"),
    ).toThrow(/PDF/);
  });

  it("round-trips attachment meta", () => {
    const meta = {
      documentId: "doc-1",
      fileName: "estados.pdf",
      mimeType: "application/pdf" as const,
    };
    const raw = serializeAttachmentMeta(meta);
    expect(raw.startsWith(ATTACHMENT_PREFIX)).toBe(true);
    expect(parseAttachmentMeta(raw)).toEqual(meta);
  });
});
