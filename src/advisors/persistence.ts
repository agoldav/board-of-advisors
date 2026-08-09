/**
 * Persistence for the advice engine. Raw SQL, every statement scoped by owner_id
 * (D-030). Split so the engine can persist the operation input BEFORE the model
 * call and commit it independently (D-029) — that committed row is what a manual
 * resume replays if credits run out mid-request.
 */
import type { PoolClient } from "pg";
import { withTransaction } from "../db/pool.js";
import type { Usage, ModelId } from "../config/models.js";
import type { OperationKind } from "../llm/router.js";

export type OperationStatus = "pending" | "completed" | "failed_credits" | "failed_other";

/**
 * Persist an operation's input and COMMIT it before the API call (D-029).
 * Returns the operation id.
 */
export async function startOperation(args: {
  ownerId: string;
  kind: OperationKind;
  inputState: unknown;
  model?: ModelId;
}): Promise<string> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO llm_operations (owner_id, kind, input_state, status, model_used)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING id`,
      [args.ownerId, args.kind, args.inputState, args.model ?? null],
    );
    return rows[0]!.id;
  });
}

export async function completeOperation(args: {
  ownerId: string;
  operationId: string;
  status: OperationStatus;
  usage?: Usage;
  model?: ModelId;
}): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE llm_operations
          SET status = $1,
              usage = COALESCE($2, usage),
              model_used = COALESCE($3, model_used),
              completed_at = now()
        WHERE id = $4 AND owner_id = $5`,
      [args.status, args.usage ?? null, args.model ?? null, args.operationId, args.ownerId],
    );
  });
}

export async function saveMessage(
  client: PoolClient,
  args: {
    ownerId: string;
    conversationId: string;
    role: "user" | "assistant" | "system";
    content: string;
    advisorId?: string;
    modelUsed?: string;
    usage?: Usage;
  },
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO messages
       (owner_id, conversation_id, role, content, advisor_id, model_used, usage)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      args.ownerId,
      args.conversationId,
      args.role,
      args.content,
      args.advisorId ?? null,
      args.modelUsed ?? null,
      args.usage ?? null,
    ],
  );
  return rows[0]!.id;
}

/**
 * Save a recommendation with the full traceability set (D-035): source message,
 * data snapshot, advisor config version, model. None of it is reconstructable
 * later, so it is written at generation time or not at all.
 */
export async function saveRecommendation(
  client: PoolClient,
  args: {
    ownerId: string;
    text: string;
    rationale?: string;
    advisorId: string;
    sourceMessageId?: string;
    sourceDataSnapshot: unknown;
    advisorConfigVersion: string;
    modelUsed: ModelId;
  },
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO recommendations
       (owner_id, text, rationale, advisor_id, source_message_id,
        source_data_snapshot, advisor_config_version, model_used)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      args.ownerId,
      args.text,
      args.rationale ?? null,
      args.advisorId,
      args.sourceMessageId ?? null,
      args.sourceDataSnapshot,
      args.advisorConfigVersion,
      args.modelUsed,
    ],
  );
  return rows[0]!.id;
}
