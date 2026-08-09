/**
 * Profile versioning service.
 *
 * A profile change mints an immutable version: render the prefix ONCE, measure it
 * with the real tokenizer, assert the >= 4096-token floor (D-031), then store the
 * bytes + count and point profiles.current_version_id at it — all in one
 * transaction. Requests thereafter replay rendered_prefix verbatim (cache hits).
 *
 * If the prefix is under the floor the mint FAILS LOUDLY here. That is the whole
 * point: below 4096 Haiku silently stops caching and bills full price with no
 * error, so we turn a silent cost leak into a visible build/write failure.
 */
import type { PoolClient } from "pg";
import { withTransaction } from "../db/pool.js";
import type { LlmProvider } from "../llm/client.js";
import { PROFILE_PREFIX_TOKEN_FLOOR } from "../config/models.js";
import { renderPrefix, type ProfileContent } from "./render.js";

export class PrefixTooSmallError extends Error {
  constructor(
    readonly tokenCount: number,
    readonly floor: number,
  ) {
    super(
      `Rendered prefix is ${tokenCount} tokens, below the ${floor}-token cache ` +
        `floor. Haiku would silently decline to cache and bill full price. ` +
        `Add more business context before minting a version (D-031).`,
    );
    this.name = "PrefixTooSmallError";
  }
}

export interface ProfileVersion {
  id: string;
  profileId: string;
  version: number;
  renderedPrefix: string;
  tokenCount: number;
}

/**
 * Mint a new version for an existing profile from its current content.
 * The token count is measured against Haiku (the binding floor) because that is
 * where most calls route.
 */
export async function mintProfileVersion(
  provider: LlmProvider,
  ownerId: string,
  profileId: string,
): Promise<ProfileVersion> {
  return withTransaction(async (client: PoolClient) => {
    const { rows } = await client.query<{ content: ProfileContent }>(
      `SELECT content FROM profiles WHERE id = $1 AND owner_id = $2 FOR UPDATE`,
      [profileId, ownerId],
    );
    const profile = rows[0];
    if (!profile) {
      throw new Error(`Profile ${profileId} not found for owner ${ownerId}.`);
    }

    const renderedPrefix = renderPrefix(profile.content);
    const tokenCount = await provider.countTokens("claude-haiku-4-5", renderedPrefix);
    if (tokenCount < PROFILE_PREFIX_TOKEN_FLOOR) {
      throw new PrefixTooSmallError(tokenCount, PROFILE_PREFIX_TOKEN_FLOOR);
    }

    const { rows: verRows } = await client.query<{ next: number }>(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next
         FROM profile_versions WHERE profile_id = $1 AND owner_id = $2`,
      [profileId, ownerId],
    );
    const nextVersion = verRows[0]?.next ?? 1;

    const { rows: inserted } = await client.query<{ id: string }>(
      `INSERT INTO profile_versions
         (owner_id, profile_id, version, rendered_prefix, token_count)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [ownerId, profileId, nextVersion, renderedPrefix, tokenCount],
    );
    const versionId = inserted[0]!.id;

    await client.query(
      `UPDATE profiles SET current_version_id = $1 WHERE id = $2 AND owner_id = $3`,
      [versionId, profileId, ownerId],
    );

    return {
      id: versionId,
      profileId,
      version: nextVersion,
      renderedPrefix,
      tokenCount,
    };
  });
}

/** Read the active cached prefix for a profile (the bytes sent on every call). */
export async function getActivePrefix(
  ownerId: string,
  profileId: string,
): Promise<{ versionId: string; renderedPrefix: string } | null> {
  const { rows } = await withTransaction(async (client) =>
    client.query<{ id: string; rendered_prefix: string }>(
      `SELECT pv.id, pv.rendered_prefix
         FROM profiles p
         JOIN profile_versions pv ON pv.id = p.current_version_id
        WHERE p.id = $1 AND p.owner_id = $2`,
      [profileId, ownerId],
    ),
  );
  const row = rows[0];
  return row ? { versionId: row.id, renderedPrefix: row.rendered_prefix } : null;
}
