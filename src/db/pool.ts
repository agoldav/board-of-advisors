/**
 * PostgreSQL connection pool. Raw SQL, no ORM (matches the pure-schema decision).
 *
 * Every query in this codebase filters on owner_id (D-030). Helpers here do not
 * hide that — callers pass owner_id explicitly so the scoping is visible and a
 * test can assert no unscoped read exists.
 */
import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set (see .env.example).");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

/** Run a function inside a transaction, rolling back on any error. */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
