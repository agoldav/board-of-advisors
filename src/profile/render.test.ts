import { describe, it, expect } from "vitest";
import { renderPrefix, stableStringify } from "./render.js";

describe("prefix rendering (byte-stability — D-008)", () => {
  it("produces identical bytes regardless of key insertion order", () => {
    const a = renderPrefix({ b: 1, a: 2, nested: { y: 1, x: 2 } });
    const b = renderPrefix({ a: 2, nested: { x: 2, y: 1 }, b: 1 });
    expect(a).toBe(b);
  });

  it("is stable across repeated calls (no timestamps/randomness)", () => {
    const content = { company: "Siscon", team: ["Allan", "David"] };
    expect(renderPrefix(content)).toBe(renderPrefix(content));
  });

  it("sorts object keys deterministically", () => {
    expect(stableStringify({ z: 1, a: 2 })).toBe('{\n  "a": 2,\n  "z": 1\n}');
  });

  it("changes bytes when content changes (new content => new cache write)", () => {
    expect(renderPrefix({ a: 1 })).not.toBe(renderPrefix({ a: 2 }));
  });
});
