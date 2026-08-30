import { describe, it, expect } from "vitest";
import { getAdvisor, listAdvisors, renderAdvisorInstructions } from "./registry.js";
import { PRESET_EXPERT_COUNT } from "./presets.js";

describe("advisor registry", () => {
  it("loads the fully-defined financiero advisor", () => {
    const financiero = getAdvisor("financiero");
    expect(financiero.id).toBe("financiero");
    expect(financiero.version).toBe("1");
    expect(financiero.not_my_job).toContain("contracts");
  });

  it("maps legacy finance id to financiero", () => {
    const finance = getAdvisor("finance");
    expect(finance.id).toBe("financiero");
  });

  it("loads name-only stubs (operaciones)", () => {
    const ops = getAdvisor("operaciones");
    expect(ops.id).toBe("operaciones");
    expect(ops.version).toBe("0");
  });

  it("throws on unknown advisor", () => {
    expect(() => getAdvisor("nope")).toThrow();
  });

  it("renders a compact instruction delta that states not_my_job (D-034)", () => {
    const text = renderAdvisorInstructions(getAdvisor("financiero"));
    expect(text).toContain("Financiero");
    expect(text).toContain("financiero v1");
    expect(text.toLowerCase()).toContain("not your job");
  });

  it("registers all seven preset expert types", () => {
    const ids = listAdvisors().map((a) => a.id);
    expect(ids).toContain("financiero");
    expect(ids).toContain("operaciones");
    expect(ids).toContain("legal");
    expect(ids.length).toBeGreaterThanOrEqual(PRESET_EXPERT_COUNT);
  });
});
