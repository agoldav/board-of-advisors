import { describe, it, expect } from "vitest";
import { assertSweepSecret, SweepAuthError } from "./sweepAuth.js";

describe("assertSweepSecret (D-036)", () => {
  const secret = "test-sweep-secret-value";

  it("accepts Authorization Bearer", () => {
    expect(() =>
      assertSweepSecret({ authorization: `Bearer ${secret}` }, secret),
    ).not.toThrow();
  });

  it("accepts X-Sweep-Secret", () => {
    expect(() =>
      assertSweepSecret({ "x-sweep-secret": secret }, secret),
    ).not.toThrow();
  });

  it("rejects missing secret", () => {
    expect(() => assertSweepSecret({}, secret)).toThrow(SweepAuthError);
  });

  it("rejects wrong secret", () => {
    expect(() =>
      assertSweepSecret({ authorization: "Bearer nope" }, secret),
    ).toThrow(SweepAuthError);
  });

  it("fails loud when env secret is unset", () => {
    expect(() => assertSweepSecret({ authorization: "Bearer x" }, "")).toThrow(
      /SWEEP_SHARED_SECRET/,
    );
  });
});
