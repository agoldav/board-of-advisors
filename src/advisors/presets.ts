/**
 * Seven preset board expert types (D-040). Custom advisors use expertType "custom".
 */
export const PRESET_EXPERT_TYPES = [
  { id: "financiero", defaultTitle: "Financiero" },
  { id: "mercadeo", defaultTitle: "Mercadeo" },
  { id: "operaciones", defaultTitle: "Operaciones" },
  { id: "ventas", defaultTitle: "Ventas" },
  { id: "pm", defaultTitle: "PM" },
  { id: "it", defaultTitle: "IT" },
  { id: "legal", defaultTitle: "Legal" },
] as const;

export type PresetExpertType = (typeof PRESET_EXPERT_TYPES)[number]["id"];

export const CUSTOM_EXPERT_TYPE = "custom" as const;

export const PRESET_EXPERT_COUNT = PRESET_EXPERT_TYPES.length;

export function isPresetExpertType(id: string): id is PresetExpertType {
  return PRESET_EXPERT_TYPES.some((p) => p.id === id);
}

export function defaultTitleForExpertType(id: string): string {
  const preset = PRESET_EXPERT_TYPES.find((p) => p.id === id);
  return preset?.defaultTitle ?? "Nuevo asesor";
}

export function listPresetExpertTypeIds(): PresetExpertType[] {
  return PRESET_EXPERT_TYPES.map((p) => p.id);
}

/** Match a rail card title to a preset expert type, if any. */
export function presetTypeForTitle(title: string): PresetExpertType | null {
  const normalized = title.trim().toLowerCase();
  for (const preset of PRESET_EXPERT_TYPES) {
    if (preset.defaultTitle.toLowerCase() === normalized) return preset.id;
  }
  return null;
}
