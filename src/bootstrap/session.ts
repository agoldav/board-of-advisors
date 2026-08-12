/**
 * POC session bootstrap: one owner, one profile (minted), one conversation.
 * No auth UI (D-030) — owner_id is created once and reused via env / response.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { getPool, withTransaction } from "../db/pool.js";
import { createProvider } from "../llm/client.js";
import { mintProfileVersion, getActivePrefix } from "../profile/service.js";
import type { ProfileContent } from "../profile/render.js";

export interface SessionIds {
  ownerId: string;
  profileId: string;
  conversationId: string;
  timezone: string;
  ownerName: string;
}

function defaultProfileContent(): ProfileContent {
  // Enough structured context for a stable prefix; mock tokenizer clears the floor.
  return {
    company: "Siscon",
    owner: "Abraham",
    location: "Costa Rica",
    what_we_do:
      "Installation of specialized building materials (polycarbonate roofs, " +
      "composite aluminum facades, perforated aluminum, phenolic panels, louvers).",
    customers: [
      "Construction companies (subcontract)",
      "House developers",
      "End clients / homeowners",
    ],
    revenue_mix: {
      eurohogar_casamax: "80%",
      developers_small: "20%",
    },
    constraints: [
      "Slow cash collection",
      "Limited reserves",
      "Growth vs hiring tension",
    ],
    concerns: [
      "Cash vs accounting profit gap",
      "Receivables aging",
      "Whether to hire ahead of larger bids",
    ],
  };
}

async function loadBusinessContextFallback(): Promise<ProfileContent> {
  const path = resolve(process.cwd(), "BUSINESS_CONTEXT.md");
  if (!existsSync(path)) return defaultProfileContent();
  try {
    const text = readFileSync(path, "utf8");
    return { ...defaultProfileContent(), business_context_md: text.slice(0, 12000) };
  } catch {
    return defaultProfileContent();
  }
}

/**
 * Ensure a usable session exists. If OWNER_ID is set and valid, reuse it;
 * otherwise create owner + profile + conversation and mint a profile version.
 */
export async function ensureSession(args?: {
  ownerId?: string;
  ownerName?: string;
  timezone?: string;
}): Promise<SessionIds> {
  const pool = getPool();
  const preferredOwnerId =
    args?.ownerId?.trim() || process.env.OWNER_ID?.trim() || "";
  const ownerName = args?.ownerName?.trim() || "Abraham";
  const timezone = args?.timezone?.trim() || "America/Costa_Rica";

  if (preferredOwnerId) {
    const { rows } = await pool.query<{
      id: string;
      name: string;
      timezone: string;
    }>(`SELECT id, name, timezone FROM owners WHERE id = $1`, [preferredOwnerId]);
    const owner = rows[0];
    if (owner) {
      const profileId = await ensureProfile(owner.id);
      const conversationId = await ensureConversation(owner.id);
      await ensureProfileVersion(owner.id, profileId);
      return {
        ownerId: owner.id,
        profileId,
        conversationId,
        timezone: owner.timezone,
        ownerName: owner.name,
      };
    }
  }

  return withTransaction(async (client) => {
    const { rows: ownerRows } = await client.query<{ id: string }>(
      `INSERT INTO owners (name, timezone) VALUES ($1, $2) RETURNING id`,
      [ownerName, timezone],
    );
    const ownerId = ownerRows[0]!.id;

    const content = await loadBusinessContextFallback();
    const { rows: profileRows } = await client.query<{ id: string }>(
      `INSERT INTO profiles (owner_id, content) VALUES ($1, $2::jsonb) RETURNING id`,
      [ownerId, JSON.stringify(content)],
    );
    const profileId = profileRows[0]!.id;

    const { rows: convRows } = await client.query<{ id: string }>(
      `INSERT INTO conversations (owner_id, title) VALUES ($1, $2) RETURNING id`,
      [ownerId, "Primera lectura"],
    );
    const conversationId = convRows[0]!.id;

    // Mint outside this transaction? mintProfileVersion opens its own.
    // Commit owner/profile/conversation first by returning, then mint below.
    return { ownerId, profileId, conversationId, timezone, ownerName };
  }).then(async (ids) => {
    await ensureProfileVersion(ids.ownerId, ids.profileId);
    return ids;
  });
}

async function ensureProfile(ownerId: string): Promise<string> {
  const pool = getPool();
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM profiles WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [ownerId],
  );
  if (rows[0]) return rows[0].id;

  const content = await loadBusinessContextFallback();
  const { rows: inserted } = await pool.query<{ id: string }>(
    `INSERT INTO profiles (owner_id, content) VALUES ($1, $2::jsonb) RETURNING id`,
    [ownerId, JSON.stringify(content)],
  );
  return inserted[0]!.id;
}

async function ensureConversation(ownerId: string): Promise<string> {
  const pool = getPool();
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM conversations WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [ownerId],
  );
  if (rows[0]) return rows[0].id;
  const { rows: inserted } = await pool.query<{ id: string }>(
    `INSERT INTO conversations (owner_id, title) VALUES ($1, $2) RETURNING id`,
    [ownerId, "Primera lectura"],
  );
  return inserted[0]!.id;
}

async function ensureProfileVersion(
  ownerId: string,
  profileId: string,
): Promise<void> {
  const active = await getActivePrefix(ownerId, profileId);
  if (active) return;
  const provider = createProvider();
  await mintProfileVersion(provider, ownerId, profileId);
}
