-- Board of Advisors — Initial database schema
-- Engine: PostgreSQL (ACID for financial data; JSONB for loose fields)
-- Scope: POC — single owner, 4 subsystems. See docs/07-DATA-MODEL.md (LOCKED).
--
-- Task 1: pure schema. No ORM / application logic.
--
-- Invariants enforced here (from PROJECT_CONTEXT):
--   D-030  owner_id on EVERY table from day one (a test asserts no unscoped read).
--   D-031  profile_versions.rendered_prefix must be >= 4096 tokens (Haiku 4.5 cache floor).
--   D-033  commitment `overdue` is COMPUTED on read, NEVER stored.
--   D-035  every recommendation carries source_message_id + source_data_snapshot
--          + advisor_config_version + model_used (the traceability set).
--   D-029  llm_operations persists input_state BEFORE the model call (safe resume).
--   D-037  extracted_figures stores every line item, not just totals.
--
-- Advisors are NOT a table: personas live in versioned config files
-- (docs/07-DATA-MODEL.md "What deliberately stays loose"). The advisor version
-- string is recorded on each recommendation for traceability.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------

CREATE TYPE document_kind AS ENUM (
    'financial_statement',
    'contract',
    'chat_export',
    'other'
);

CREATE TYPE document_status AS ENUM (
    'uploaded',
    'extracted',
    'confirmed',
    'rejected'
);

CREATE TYPE statement_section AS ENUM (
    'assets',
    'liabilities',
    'equity',
    'revenue',
    'expense'
);

CREATE TYPE message_role AS ENUM (
    'user',
    'assistant',
    'system'
);

-- Five logical states (docs/07-DATA-MODEL.md state machine). `overdue` is a
-- DERIVED state (D-033): it is intentionally forbidden as a stored value by a
-- CHECK constraint on `commitments` and is computed on read from due_date +
-- owner timezone. It lives in the enum so the type documents the full machine.
CREATE TYPE commitment_status AS ENUM (
    'pending',
    'overdue',
    'done',
    'deferred',
    'dismissed'
);

CREATE TYPE followup_channel AS ENUM (
    'email',
    'in_app'
);

CREATE TYPE llm_operation_kind AS ENUM (
    'extraction',
    'first_read',
    'chat',
    'classification'
);

CREATE TYPE llm_operation_status AS ENUM (
    'pending',
    'completed',
    'failed_credits',
    'failed_other'
);

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger (schema-level, not application logic)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- owners  (root tenant; present from day one — D-027 / D-030)
-- ---------------------------------------------------------------------------

CREATE TABLE owners (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    -- Required: commitment due dates resolve in the owner's zone, not the
    -- server's. Omitting it fires nudges a day early/late, silently.
    timezone    TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_owners_updated_at
    BEFORE UPDATE ON owners
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles / profile_versions  (versioned, byte-stable cached prefix — D-008/D-031)
-- ---------------------------------------------------------------------------

CREATE TABLE profiles (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id           UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    -- Loose by design: what the business does, who buys, structure, headcount,
    -- concerns, competitors. Schema-free so it grows without migrations.
    content            JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- FK to profile_versions added after that table exists (mutual reference).
    current_version_id UUID,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE profile_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    version         INTEGER NOT NULL,
    -- The exact bytes sent to the model. Rendered ONCE at write time, never at
    -- request time — that is what keeps cache reads hitting.
    rendered_prefix TEXT NOT NULL,
    -- Measured with count_tokens. Below 4096 Haiku 4.5 silently does not cache
    -- and bills full price with no error (D-031).
    token_count     INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT profile_versions_token_floor CHECK (token_count >= 4096),
    CONSTRAINT profile_versions_unique_version UNIQUE (profile_id, version)
);

ALTER TABLE profiles
    ADD CONSTRAINT profiles_current_version_fk
    FOREIGN KEY (current_version_id) REFERENCES profile_versions(id);

CREATE INDEX idx_profiles_owner ON profiles(owner_id);
CREATE INDEX idx_profile_versions_owner ON profile_versions(owner_id);
CREATE INDEX idx_profile_versions_profile ON profile_versions(profile_id);

-- ---------------------------------------------------------------------------
-- documents / extracted_figures  (every line item — D-037)
-- ---------------------------------------------------------------------------

CREATE TABLE documents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    kind          document_kind NOT NULL,
    -- Source is kept: some questions need the original, not the extraction.
    original_path TEXT,             -- pointer to blob storage
    original_bytes BYTEA,           -- optional inline copy for small files
    period_start  DATE,             -- for financial statements
    period_end    DATE,
    status        document_status NOT NULL DEFAULT 'uploaded',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE extracted_figures (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id           UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    document_id        UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    line_item          TEXT NOT NULL,        -- e.g. "accounts receivable"
    value              NUMERIC(18, 2) NOT NULL,
    statement_section  statement_section NOT NULL,
    -- No advice is generated from unconfirmed figures.
    confirmed_by_owner BOOLEAN NOT NULL DEFAULT FALSE,
    corrected_by_owner BOOLEAN NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_owner ON documents(owner_id);
CREATE INDEX idx_extracted_figures_owner ON extracted_figures(owner_id);
CREATE INDEX idx_extracted_figures_document ON extracted_figures(document_id);

-- ---------------------------------------------------------------------------
-- conversations / messages
-- ---------------------------------------------------------------------------

CREATE TABLE conversations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    title      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            message_role NOT NULL,
    content         TEXT NOT NULL,
    advisor_id      TEXT,        -- which advisor spoke; null for user messages
    model_used      TEXT,        -- e.g. 'claude-sonnet-5'
    -- Token counts from the API response; the spend counter accumulates here.
    usage           JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_owner ON conversations(owner_id);
CREATE INDEX idx_messages_owner ON messages(owner_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);

-- ---------------------------------------------------------------------------
-- recommendations  (traceability set — D-035)
-- ---------------------------------------------------------------------------

CREATE TABLE recommendations (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id              UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    text                  TEXT NOT NULL,   -- owner-visible
    rationale             TEXT,            -- why the board said it
    advisor_id            TEXT NOT NULL,   -- who said it
    -- The four traceability fields (D-035). None reconstructable later.
    source_message_id     UUID REFERENCES messages(id) ON DELETE SET NULL,
    source_data_snapshot  JSONB NOT NULL,  -- figures reasoned about, at gen time
    advisor_config_version TEXT NOT NULL,  -- advisor instruction version
    model_used            TEXT NOT NULL,   -- model that produced it
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recommendations_owner ON recommendations(owner_id);
CREATE INDEX idx_recommendations_source_message ON recommendations(source_message_id);

-- ---------------------------------------------------------------------------
-- commitments  (5-state machine; overdue computed on read — D-033)
-- ---------------------------------------------------------------------------

CREATE TABLE commitments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id          UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    text              TEXT NOT NULL,   -- may be edited from the recommendation
    due_date          DATE NOT NULL,   -- resolved in owners.timezone
    status            commitment_status NOT NULL DEFAULT 'pending',
    deferred_to       DATE,            -- set when status = 'deferred'
    dismissed_reason  TEXT,            -- REQUIRED when status = 'dismissed'
    closed_evidence   TEXT,            -- what the owner said when marking done
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- D-033: overdue is derived, never persisted.
    CONSTRAINT commitments_overdue_not_stored
        CHECK (status <> 'overdue'),
    -- dismissed_reason is the highest-signal field: required on dismissal.
    CONSTRAINT commitments_dismissed_needs_reason
        CHECK (status <> 'dismissed' OR dismissed_reason IS NOT NULL),
    -- a deferral must carry its new date.
    CONSTRAINT commitments_deferred_needs_date
        CHECK (status <> 'deferred' OR deferred_to IS NOT NULL)
);

CREATE TRIGGER trg_commitments_updated_at
    BEFORE UPDATE ON commitments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_commitments_owner ON commitments(owner_id);
CREATE INDEX idx_commitments_recommendation ON commitments(recommendation_id);
CREATE INDEX idx_commitments_due_date ON commitments(due_date);

-- ---------------------------------------------------------------------------
-- followups  (idempotent nudges — two sweeps, one email)
-- ---------------------------------------------------------------------------

CREATE TABLE followups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    commitment_id   UUID NOT NULL REFERENCES commitments(id) ON DELETE CASCADE,
    scheduled_for   DATE NOT NULL,
    sent_at         TIMESTAMPTZ,        -- null until dispatched
    channel         followup_channel NOT NULL,
    -- commitment_id + scheduled_for; prevents duplicate emails on a double sweep.
    idempotency_key TEXT NOT NULL UNIQUE,
    response        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_followups_owner ON followups(owner_id);
CREATE INDEX idx_followups_commitment ON followups(commitment_id);

-- ---------------------------------------------------------------------------
-- llm_operations  (persist-before-call, safe resume — D-029)
-- ---------------------------------------------------------------------------

CREATE TABLE llm_operations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    kind         llm_operation_kind NOT NULL,
    -- Everything needed to retry — WRITTEN BEFORE the API call (D-029).
    input_state  JSONB NOT NULL,
    status       llm_operation_status NOT NULL DEFAULT 'pending',
    model_used   TEXT,
    usage        JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_llm_operations_owner ON llm_operations(owner_id);
CREATE INDEX idx_llm_operations_status ON llm_operations(status);

COMMIT;
