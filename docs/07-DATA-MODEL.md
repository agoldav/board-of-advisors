# Data Model

**Status:** LOCKED by `/plan-eng-review` on 2026-08-08.
**Scope:** POC — Approach A, 4 subsystems, single owner.

The accountability pillar requires recommendations, commitments, and follow-up state as
**first-class entities, not messages with metadata**. This is the one decision in the
project that cannot be retrofitted: changing it later means migrating months of the
owner's real business conversations.

---

## Entity Relationship

```
owners
  └── profiles ──── profile_versions ──── (rendered cached prefix)
  └── documents ─── extracted_figures
  └── conversations ─── messages
                            │
                            ▼
                     recommendations ──── commitments ──── followups
                            │
                            └──► traceability: source message,
                                 data snapshot, advisor version, model
```

---

## Core Entities

### `owners`
Present from day one even though there is only one. Adding an owner column later means
migrating real data — see Decision D-027.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID, PK | |
| `name` | text | |
| `timezone` | text | **Required.** Commitment due dates resolve in the owner's zone, not the server's. Omitting this produces nudges that fire a day early or late, silently. |
| `created_at` / `updated_at` | timestamp | |

**Every other table carries `owner_id`.** Every query filters on it. A test asserts no
unscoped read exists.

---

### `profiles` and `profile_versions`

The business profile evolves (data is collected when it becomes necessary, not up front).
The cached prefix must be byte-identical across requests. These two requirements conflict,
and versioning resolves it.

**`profiles`** — the current, editable state.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID, PK | |
| `owner_id` | UUID, FK | |
| `content` | JSON | Loose by design: what the business does, who buys, structure, headcount, concerns, competitors. Schema-free so it can grow without migrations. |
| `current_version_id` | UUID, FK | Points at the active rendered version |

**`profile_versions`** — immutable snapshots. One per profile change.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID, PK | |
| `profile_id` | UUID, FK | |
| `version` | integer | Monotonic |
| `rendered_prefix` | text | The exact bytes sent to the model. **Rendered once at write time, never at request time.** |
| `token_count` | integer | Measured with `count_tokens`. **Build fails under 4096** — below that, Haiku 4.5 silently does not cache and bills full price with no error. |
| `created_at` | timestamp | |

Requests reference `current_version_id`. The prefix is byte-identical within a version, so
cache reads hit. A profile change mints a new version and costs one cache write.

---

### `documents` and `extracted_figures`

**`documents`**

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID, PK | |
| `owner_id` | UUID, FK | |
| `kind` | enum | `financial_statement`, `contract`, `chat_export`, `other` |
| `original_file` | blob/path | Kept — some questions need the source, not the extraction |
| `period_start` / `period_end` | date | For financial statements |
| `status` | enum | `uploaded`, `extracted`, `confirmed`, `rejected` |

**`extracted_figures`** — every line item, not just totals. Extracting only summaries
would force a full PDF re-send on Use Case C, which is a line-item question.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID, PK | |
| `document_id` | UUID, FK | |
| `line_item` | text | e.g. "accounts receivable" |
| `value` | decimal | |
| `statement_section` | enum | `assets`, `liabilities`, `equity`, `revenue`, `expense` |
| `confirmed_by_owner` | boolean | **No advice is generated from unconfirmed figures.** |
| `corrected_by_owner` | boolean | True when the owner overrode the extraction |

**Arithmetic validation runs before confirmation:** assets = liabilities + equity,
subtotals sum to totals. A statement that doesn't reconcile is surfaced, never silently used.

---

### `conversations` and `messages`

Standard chat storage. Messages are the raw record; recommendations are extracted from
them and live independently.

| `messages` field | Type | Notes |
|------------------|------|-------|
| `id` | UUID, PK | |
| `conversation_id` | UUID, FK | |
| `role` | enum | `user`, `assistant`, `system` |
| `content` | text | |
| `advisor_id` | text | Which advisor spoke, null for user messages |
| `model_used` | text | e.g. `claude-sonnet-5` |
| `usage` | JSON | Token counts from the API response — the spend counter accumulates from here |

---

### `recommendations`

What the board told the owner to do. Extracted from a message but independent of it.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID, PK | |
| `owner_id` | UUID, FK | |
| `text` | text | Owner-visible |
| `rationale` | text | Why the board said it |
| `advisor_id` | text | Who said it |
| **`source_message_id`** | UUID, FK | The message it came from |
| **`source_data_snapshot`** | JSON | The figures it was reasoning about, captured at generation time |
| **`advisor_config_version`** | text | Which version of the advisor's instructions produced it |
| **`model_used`** | text | Which model produced it |
| `created_at` | timestamp | |

The four bold fields are the traceability set. Without `advisor_config_version` and
`model_used` you cannot distinguish a bad recommendation caused by bad data from one
caused by a bad prompt. **None of this can be reconstructed later.**

---

### `commitments`

A recommendation the owner accepted, with a date.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID, PK | |
| `owner_id` | UUID, FK | |
| `recommendation_id` | UUID, FK | |
| `text` | text | May be edited from the recommendation's wording |
| `due_date` | date | Resolved in `owners.timezone` |
| `status` | enum | Five values — see the state machine below |
| `deferred_to` | date, nullable | Set when status is `deferred` |
| `dismissed_reason` | text, nullable | **Required** when status is `dismissed` |
| `closed_evidence` | text, nullable | What the owner said when marking it done |
| `created_at` / `updated_at` | timestamp | |

### Commitment state machine

```
                    ┌──────────────► done (evidence captured)
                    │
    pending ────────┼──────────────► dismissed (reason REQUIRED)
        │           │
        │           └──────────────► deferred ──► (new due_date) ──┐
        │                                                          │
        └──► [due_date passes] ──► overdue ──► board asks ──────────┘
                                       │
                                       ├──► done
                                       ├──► deferred
                                       └──► dismissed
```

`overdue` is **computed on read** from `due_date` and the owner's timezone — it is not a
stored flag that a background job has to keep current. The UI needs this calculation on
every render regardless of whether any scheduler runs.

`dismissed_reason` is the highest-signal field in the system: it is the record of which
advice was rejected and why. Requiring it is deliberate.

---

### `followups`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID, PK | |
| `commitment_id` | UUID, FK | |
| `scheduled_for` | date | |
| `sent_at` | timestamp, nullable | Null until dispatched |
| `channel` | enum | `email`, `in_app` |
| `idempotency_key` | text, unique | `commitment_id + scheduled_for`. **Prevents duplicate emails when the sweep runs twice in one day.** |
| `response` | text, nullable | What the owner said back |

---

### `llm_operations`

Every model call persists its input **before** the call, not after. Without this there is
nothing to resume when credits run out mid-operation.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID, PK | |
| `owner_id` | UUID, FK | |
| `kind` | enum | `extraction`, `first_read`, `chat`, `classification` |
| `input_state` | JSON | Everything needed to retry — written before the API call |
| `status` | enum | `pending`, `completed`, `failed_credits`, `failed_other` |
| `model_used` | text | |
| `usage` | JSON | |
| `created_at` / `completed_at` | timestamp | |

On `failed_credits`: the owner sees *"se acabaron los créditos de tu cuenta, recargá en
Anthropic"* with a link. Nothing is lost. When the owner returns and confirms credits are
restored, the operation resumes from `input_state`.

---

## What deliberately stays loose

Not everything belongs in a table. These are stored as JSON or configuration files so they
can change without a migration:

| Item | Where it lives | Why |
|------|----------------|-----|
| Business profile content | `profiles.content` (JSON) | It evolves constantly; columns would mean a migration per new question |
| Advisor personas | Config files, versioned | Adding an advisor should be writing a file, not altering a schema |
| Report formats | Config / templates | Presentation, not data |
| Raw QuickBooks dumps | Blob storage + derived tables | Keep the raw so a new field can be derived later without re-calling the API |

---

## Advisor configuration structure

Shared, in one place (business context, output format, tone rules). Per advisor, only the
delta:

```yaml
id: finance
version: "1"                    # bumped on every edit; stored on each recommendation
name: "Asesor Financiero"
expertise: >
  Flujo de caja, cobros, márgenes, dónde se va la plata que no aparece en el
  estado de resultados, y si alcanza para contratar.
can_see: [financial_statements, business_profile]
not_my_job: [contracts, hr, marketing]
```

`not_my_job` is the field most often omitted and the one that prevents the worst failure:
a finance advisor answering a legal question with false confidence instead of handing off.

**Roster decision:** the finance advisor is defined in full now (Use Case C is the first
read). The others exist as names and get filled in when first asked.

---

## Data Retention

POC: nothing is deleted. Single owner, own data. Retention policy returns as a requirement
when a second company's data enters the system — see
[Open Questions](17-OPEN-QUESTIONS.md).

---

**Last Updated:** 2026-08-08
**Locked by:** `/plan-eng-review`
**Source:** `~/.gstack/projects/BoardofAdvisors/abraham-unknown-design-20260808-001241.md`
