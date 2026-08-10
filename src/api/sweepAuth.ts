/**
 * Shared-secret auth for the sweep endpoint (D-036).
 * Constant-time compare so timing does not leak the secret length match.
 */
import { timingSafeEqual } from "node:crypto";

export class SweepAuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "SweepAuthError";
  }
}

function readHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

/**
 * Accepts either `Authorization: Bearer <secret>` or `X-Sweep-Secret: <secret>`.
 * Throws SweepAuthError when missing/wrong. Throws if SWEEP_SHARED_SECRET unset.
 */
export function assertSweepSecret(
  headers: Record<string, string | string[] | undefined>,
  expected = process.env.SWEEP_SHARED_SECRET,
): void {
  if (!expected) {
    throw new Error("SWEEP_SHARED_SECRET is not configured.");
  }

  const bearer = readHeader(headers, "authorization");
  const dedicated = readHeader(headers, "x-sweep-secret");
  let provided: string | undefined;
  if (dedicated) {
    provided = dedicated.trim();
  } else if (bearer?.toLowerCase().startsWith("bearer ")) {
    provided = bearer.slice(7).trim();
  }

  if (!provided) {
    throw new SweepAuthError("Missing sweep shared secret.");
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new SweepAuthError("Invalid sweep shared secret.");
  }
}
