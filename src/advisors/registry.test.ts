import { describe, it, expect } from "vitest";
import { getAdvisor, listAdvisors, renderAdvisorInstructions } from "./registry.js";

describe("advisor registry", () => {
  it("loads the fully-defined finance advisor", () => {
    const finance = getAdvisor("finance");
    expect(finance.id).toBe("finance");
    expect(finance.version).toBe("1");
    expect(finance.not_my_job).toContain("contracts");
  });

  it("loads name-only stubs (operations)", () => {
    const ops = getAdvisor("operations");
    expect(ops.id).toBe("operations");
    expect(ops.version).toBe("0");
  });

  it("throws on unknown advisor", () => {
    expect(() => getAdvisor("nope")).toThrow();
  });

  it("renders a compact instruction delta that states not_my_job (D-034)", () => {
    const text = renderAdvisorInstructions(getAdvisor("finance"));
    expect(text).toContain("Asesor Financiero");
    expect(text).toContain("finance v1");
    expect(text.toLowerCase()).toContain("not your job");
  });

  it("registers at least finance and operations", () => {
    const ids = listAdvisors().map((a) => a.id);
    expect(ids).toContain("finance");
    expect(ids).toContain("operations");
  });
});
