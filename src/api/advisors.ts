/**
 * Public preset expert types for the UI (D-040).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { PRESET_EXPERT_TYPES } from "../advisors/presets.js";
import { getAdvisor } from "../advisors/registry.js";

type SendJson = (
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
) => void;

export async function tryHandleAdvisorsRequest(args: {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  sendJson: SendJson;
}): Promise<boolean> {
  const { req, res, pathname, sendJson } = args;

  if (pathname === "/api/advisors" && req.method === "GET") {
    const items = PRESET_EXPERT_TYPES.map((preset) => {
      const cfg = getAdvisor(preset.id);
      return {
        id: preset.id,
        name: preset.defaultTitle,
        expertise: cfg.expertise.trim(),
        version: cfg.version,
      };
    });
    sendJson(res, 200, { ok: true, items });
    return true;
  }

  return false;
}
