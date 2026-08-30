import { describe, expect, it } from "vitest";
import { presetTypeForTitle } from "./presets.js";

describe("presetTypeForTitle", () => {
  it("matches preset titles case-insensitively", () => {
    expect(presetTypeForTitle("Ventas")).toBe("ventas");
    expect(presetTypeForTitle(" operaciones ")).toBe("operaciones");
    expect(presetTypeForTitle("pm")).toBe("pm");
  });

  it("returns null for unknown titles", () => {
    expect(presetTypeForTitle("Estratega LATAM")).toBeNull();
  });
});
