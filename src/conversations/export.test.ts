import { describe, expect, it } from "vitest";
import {
  InvalidConversationExportError,
  parseConversationExport,
  serializeConversationExport,
  titleFromQuestion,
} from "./export.js";

describe("titleFromQuestion", () => {
  it("uses the first line, truncated", () => {
    expect(titleFromQuestion("  ¿Dónde está la plata?  ")).toBe(
      "¿Dónde está la plata?",
    );
    const long = "A".repeat(80);
    expect(titleFromQuestion(long)).toBe(`${"A".repeat(57)}…`);
  });

  it("falls back when empty", () => {
    expect(titleFromQuestion("   \n")).toBe("Nuevo hilo");
  });
});

describe("conversation export", () => {
  const sample = serializeConversationExport({
    title: "Where is the money",
    createdAt: "2026-08-01T12:00:00.000Z",
    exportedAt: "2026-08-11T12:00:00.000Z",
    messages: [
      {
        role: "user",
        content: "¿Puedo contratar?",
        advisorId: null,
        modelUsed: null,
        createdAt: "2026-08-01T12:01:00.000Z",
      },
      {
        role: "assistant",
        content: "Todavía no.",
        advisorId: "financiero",
        modelUsed: "claude-sonnet-5",
        createdAt: "2026-08-01T12:01:05.000Z",
      },
    ],
  });

  it("round-trips a valid snapshot", () => {
    const parsed = parseConversationExport(JSON.parse(JSON.stringify(sample)));
    expect(parsed).toEqual(sample);
  });

  it("rejects a bad version or missing messages", () => {
    expect(() => parseConversationExport({ version: 2, conversation: {} })).toThrow(
      InvalidConversationExportError,
    );
    expect(() =>
      parseConversationExport({ version: 1, conversation: { title: "x" } }),
    ).toThrow(/messages/);
  });

  it("rejects a bad date", () => {
    expect(() =>
      parseConversationExport({
        version: 1,
        conversation: { title: "x", createdAt: "not-a-date", messages: [] },
      }),
    ).toThrow(/Fecha/);
  });

  it("rejects empty message content", () => {
    expect(() =>
      parseConversationExport({
        version: 1,
        conversation: {
          title: "x",
          messages: [{ role: "user", content: "  " }],
        },
      }),
    ).toThrow(/content/);
  });
});
