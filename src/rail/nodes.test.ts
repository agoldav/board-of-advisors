import { describe, expect, it } from "vitest";
import {
  parseRailMeta,
  serializeRailMeta,
  wouldCreateCycle,
} from "./nodes.js";

describe("rail nodes", () => {
  it("round-trips rail meta", () => {
    const raw = serializeRailMeta({
      kind: "advisor",
      parentId: null,
      sortOrder: 2,
      archived: false,
      expertType: "financiero",
      advisorId: "financiero",
    });
    expect(parseRailMeta(raw)).toEqual({
      kind: "advisor",
      parentId: null,
      sortOrder: 2,
      archived: false,
      expertType: "financiero",
      advisorId: "financiero",
    });
  });

  it("rejects non-rail system content", () => {
    expect(parseRailMeta("__boa_anchor_v1__\n{}")).toBeNull();
  });

  it("detects cycles", () => {
    const parentById = new Map<string, string | null>([
      ["a", null],
      ["b", "a"],
      ["c", "b"],
    ]);
    expect(
      wouldCreateCycle({ nodeId: "a", newParentId: "c", parentById }),
    ).toBe(true);
    expect(
      wouldCreateCycle({ nodeId: "c", newParentId: "a", parentById }),
    ).toBe(false);
    expect(
      wouldCreateCycle({ nodeId: "b", newParentId: "b", parentById }),
    ).toBe(true);
  });
});
