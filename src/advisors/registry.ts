/**
 * Advisor registry. Loads versioned YAML config files from ./configs.
 *
 * Adding an advisor is adding a file here — never a schema change (D-034). The
 * registry also renders the small per-advisor instruction block that is appended
 * after the shared, cached business-context prefix.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { AdvisorConfig } from "./types.js";

const CONFIG_DIR = join(dirname(fileURLToPath(import.meta.url)), "configs");

/** Legacy rail markers before D-040 expert type rename. */
const LEGACY_EXPERT_IDS: Record<string, string> = {
  finance: "financiero",
  operations: "operaciones",
};

export function normalizeExpertId(id: string): string {
  const trimmed = id.trim();
  return LEGACY_EXPERT_IDS[trimmed] ?? trimmed;
}

function assertConfig(raw: unknown, file: string): AdvisorConfig {
  const c = raw as Partial<AdvisorConfig>;
  for (const field of ["id", "version", "name", "expertise"] as const) {
    if (!c[field] || typeof c[field] !== "string") {
      throw new Error(`Advisor config ${file} is missing required field "${field}".`);
    }
  }
  return {
    id: c.id!,
    version: c.version!,
    name: c.name!,
    expertise: c.expertise!,
    can_see: c.can_see ?? [],
    not_my_job: c.not_my_job ?? [],
    persona: c.persona ?? "",
  };
}

let cache: Map<string, AdvisorConfig> | undefined;

function load(): Map<string, AdvisorConfig> {
  if (cache) return cache;
  const map = new Map<string, AdvisorConfig>();
  for (const file of readdirSync(CONFIG_DIR)) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
    const raw = parseYaml(readFileSync(join(CONFIG_DIR, file), "utf8"));
    const cfg = assertConfig(raw, file);
    if (map.has(cfg.id)) throw new Error(`Duplicate advisor id "${cfg.id}" (${file}).`);
    map.set(cfg.id, cfg);
  }
  cache = map;
  return map;
}

export function listAdvisors(): AdvisorConfig[] {
  return [...load().values()];
}

export function getAdvisor(id: string): AdvisorConfig {
  const cfg = load().get(normalizeExpertId(id));
  if (!cfg) throw new Error(`Unknown advisor "${id}".`);
  return cfg;
}

/**
 * The per-advisor instruction block appended AFTER the cached prefix. Kept small
 * so the big shared prefix stays byte-identical across advisors and keeps hitting
 * cache; only this short delta changes per advisor.
 */
export function renderAdvisorInstructions(cfg: AdvisorConfig): string {
  const lines = [
    `## Your seat on the board: ${cfg.name} (${cfg.id} v${cfg.version})`,
    ``,
    `Area of expertise: ${cfg.expertise.trim()}`,
  ];
  if (cfg.not_my_job.length) {
    lines.push(
      ``,
      `NOT your job (hand off by name, do not answer): ${cfg.not_my_job.join(", ")}.`,
    );
  }
  if (cfg.persona.trim()) lines.push(``, `Voice: ${cfg.persona.trim()}`);
  return lines.join("\n") + "\n";
}

/** Instructions for a custom rail advisor (D-041). */
export function renderCustomAdvisorInstructions(
  displayTitle: string,
  roleDescription: string,
): string {
  const lines = [
    `## Your seat on the board: ${displayTitle.trim()}`,
    ``,
    `This is a custom advisor defined by the business owner.`,
    ``,
    `Role and scope:`,
    roleDescription.trim(),
    ``,
    `Answer only within this role. If the question belongs to another seat on the board, ` +
      `say so and name who should handle it instead of guessing.`,
  ];
  return lines.join("\n") + "\n";
}
