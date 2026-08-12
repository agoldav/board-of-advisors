import { describe, expect, it } from "vitest";
import {
  assertPdfBytes,
  parseUploadFilename,
  PdfUploadError,
} from "./pdfUpload.js";

describe("parseUploadFilename", () => {
  it("defaults when header missing", () => {
    expect(parseUploadFilename(undefined)).toBe("estados.pdf");
  });

  it("decodes URI-encoded names and forces .pdf", () => {
    expect(parseUploadFilename("Balance%20Junio%202026")).toBe(
      "Balance Junio 2026.pdf",
    );
  });

  it("strips path segments", () => {
    expect(parseUploadFilename("C:\\Users\\a\\estados_q2.pdf")).toBe(
      "estados_q2.pdf",
    );
  });
});

describe("assertPdfBytes", () => {
  it("accepts a minimal PDF header", () => {
    expect(() =>
      assertPdfBytes(Buffer.from("%PDF-1.4\n%eof\n", "utf8")),
    ).not.toThrow();
  });

  it("rejects empty and non-PDF", () => {
    expect(() => assertPdfBytes(Buffer.alloc(0))).toThrow(PdfUploadError);
    expect(() => assertPdfBytes(Buffer.from("not a pdf"))).toThrow(
      /no es un PDF/i,
    );
  });
});
