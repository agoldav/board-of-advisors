import { describe, expect, it } from "vitest";
import {
  ANCHOR_PREFIX,
  buildParagraphModelPrompt,
  parseAnchor,
  paragraphThreadTitle,
  serializeAnchor,
} from "./anchors.js";

describe("paragraph anchors", () => {
  const sample = {
    kind: "paragraph" as const,
    sectionKey: "cobros",
    sectionTitle: "Cobros",
    excerpt: "Cuentas por cobrar cerró en 10,000.",
    parentConversationId: "parent-1",
    source: "first_reading" as const,
  };

  it("round-trips through system message content", () => {
    const raw = serializeAnchor(sample);
    expect(raw.startsWith(ANCHOR_PREFIX)).toBe(true);
    expect(parseAnchor(raw)).toEqual(sample);
  });

  it("rejects non-anchor content", () => {
    expect(parseAnchor("hola")).toBeNull();
    expect(parseAnchor(`${ANCHOR_PREFIX}\n{bad`)).toBeNull();
  });

  it("builds a title and a model prompt with history", () => {
    expect(paragraphThreadTitle("Cobros")).toBe("Sobre: Cobros");
    const prompt = buildParagraphModelPrompt({
      anchor: sample,
      question: "¿Es grave?",
      priorTurns: [
        { role: "user", content: "¿De quién son?" },
        { role: "assistant", content: "Hay que pedir el aging." },
      ],
    });
    expect(prompt).toContain("Cuentas por cobrar");
    expect(prompt).toContain("¿De quién son?");
    expect(prompt).toContain("¿Es grave?");
  });
});
