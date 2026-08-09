# Database — Board of Advisors

PostgreSQL schema for the POC. **Pure schema, no application/ORM logic** (Task 1).

Source of truth: [`docs/07-DATA-MODEL.md`](../docs/07-DATA-MODEL.md) (LOCKED).

## Migrations

Applied in filename order.

| File | Purpose |
|------|---------|
| `migrations/0001_initial_schema.sql` | All tables, enums, constraints, indexes |

Apply:

```bash
createdb board_of_advisors
psql board_of_advisors -f migrations/0001_initial_schema.sql
```

Requires PostgreSQL 13+ (uses built-in `gen_random_uuid()` via `pgcrypto`).

## Tables

| Table | Role |
|-------|------|
| `owners` | Root tenant. One today; `owner_id` on every other table (D-030). |
| `profiles` / `profile_versions` | Versioned business context; immutable, byte-stable cached prefix (D-008/D-031). |
| `documents` / `extracted_figures` | Uploaded statements + **every line item**, not just totals (D-037). |
| `conversations` / `messages` | Chat storage; `usage` JSON feeds the spend counter. |
| `recommendations` | What the board advised, with the full traceability set (D-035). |
| `commitments` | Accepted recommendations with a due date; 5-state machine (D-033). |
| `followups` | Idempotent nudges (two sweeps, one email). |
| `llm_operations` | Input persisted **before** each model call for safe resume (D-029). |

Advisors are **not** a table — personas live in versioned config files. Each
recommendation records the advisor's config version string for traceability.

## Enforced invariants

- **`owner_id` everywhere (D-030).** Present on every table from day one, including
  child tables, so every query can filter on it and a scoping test can assert no
  unscoped read exists.
- **4096-token cache floor (D-031).** `profile_versions.token_count` has a
  `CHECK (>= 4096)`; below it Haiku 4.5 silently declines to cache and bills full
  price. The application must still measure with `count_tokens` at write time.
- **`overdue` is computed, never stored (D-033).** `commitment_status` lists all
  five logical states, but a `CHECK (status <> 'overdue')` forbids persisting it.
  Overdue is derived on read from `due_date` + `owners.timezone`.
- **Dismissal requires a reason (D-033).** `CHECK`: `dismissed_reason` is non-null
  when `status = 'dismissed'` — the highest-signal record in the system.
- **Deferral requires a date.** `CHECK`: `deferred_to` non-null when
  `status = 'deferred'`.
- **Recommendation traceability (D-035).** `source_message_id`,
  `source_data_snapshot`, `advisor_config_version`, `model_used` — none
  reconstructable after the fact.
- **Persist-before-call (D-029).** `llm_operations.input_state` is written before
  the API call so a mid-request credit exhaustion is recoverable.

## Not yet stored (deliberately loose)

Profile content (`profiles.content` JSONB), advisor personas (config files),
report templates, and raw QuickBooks dumps stay out of rigid columns so they can
change without a migration. See the data model doc.
