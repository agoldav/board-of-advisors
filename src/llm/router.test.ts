import { describe, it, expect } from "vitest";
import { classifyTier, modelForTier, routeModel } from "./router.js";

describe("model router", () => {
  it("routes routine kinds to Haiku", () => {
    expect(classifyTier({ kind: "extraction" })).toBe("routine");
    expect(classifyTier({ kind: "classification" })).toBe("routine");
    expect(modelForTier("routine")).toBe("claude-haiku-4-5");
  });

  it("routes the first read to Opus (cash reconciliation is the hardest tier)", () => {
    expect(classifyTier({ kind: "first_read" })).toBe("hard");
    expect(modelForTier("hard")).toBe("claude-opus-5");
  });

  it("defaults chat to the advisory tier (Sonnet)", () => {
    expect(classifyTier({ kind: "chat", text: "¿contrato un instalador más?" })).toBe(
      "advisory",
    );
    expect(modelForTier("advisory")).toBe("claude-sonnet-5");
  });

  it("escalates hard chat questions to Opus by signal", () => {
    expect(classifyTier({ kind: "chat", text: "¿dónde está la plata que no aparece?" })).toBe(
      "hard",
    );
    expect(classifyTier({ kind: "chat", text: "should I reconcile the balance sheet?" })).toBe(
      "hard",
    );
    expect(classifyTier({ kind: "chat", text: "tengo deuda de IVA de 2 años" })).toBe("hard");
  });

  it("honors forceTier and escalate overrides", () => {
    expect(classifyTier({ kind: "chat", text: "hola", forceTier: "hard" })).toBe("hard");
    expect(classifyTier({ kind: "chat", text: "hola", escalate: true })).toBe("hard");
  });

  it("routeModel returns tier and concrete model together", () => {
    expect(routeModel({ kind: "extraction" })).toEqual({
      tier: "routine",
      model: "claude-haiku-4-5",
    });
  });
});
