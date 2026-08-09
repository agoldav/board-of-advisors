# System Architecture

**Status:** LOCKED by `/plan-eng-review` on 2026-08-08.
**Scope:** POC — Approach A ("Expediente"), 4 subsystems, single owner, documents only.

---

## Architecture Overview

```
                    ┌─────────────────────────────────────────┐
                    │            WEB APP (single owner)        │
                    └─────────────────────────────────────────┘
                                       │
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        ▼              ▼               ▼               ▼              ▼
   ┌─────────┐   ┌──────────┐   ┌────────────┐  ┌────────────┐  ┌─────────┐
   │ PROFILE │   │DOCUMENTS │   │   ADVICE   │  │COMMITMENTS │  │   LLM   │
   │         │   │          │   │   ENGINE   │  │            │  │  LAYER  │
   │ versioned│  │ extract  │   │ first read │  │ 5 states   │  │ routing │
   │ prefix   │  │ validate │   │ chat       │  │ sweep      │  │ budget  │
   │          │  │ confirm  │   │ streaming  │  │            │  │ resume  │
   └─────────┘   └──────────┘   └────────────┘  └────────────┘  └─────────┘
                                                       │              │
                                                       ▼              ▼
                                              ┌────────────────┐  ┌────────┐
                                              │ GitHub Actions │  │ Claude │
                                              │  (daily cron)  │  │  API   │
                                              └────────────────┘  └────────┘
```

The scheduler lives **outside** the hosting platform. GitHub Actions calls one
authenticated endpoint on a schedule. When the product commercializes, host cron calls the
same endpoint — the trigger changes, the logic does not.

---

## Technology Stack

| Layer | Choice | Constraint |
|-------|--------|-----------|
| Model | Claude API — Haiku 4.5 / Sonnet 5 / Opus 5, routed by task | No free tier; $5–30/month ceiling |
| Model access | Thin abstraction layer from day one | Swapping providers = editing a config file |
| Document parsing | **None.** Claude reads PDFs natively as document blocks | No parsing library to maintain |
| Scheduler | GitHub Actions scheduled workflow | Free tier cron elsewhere is unreliable |
| Hosting | Free tier, TBD | Must support env-var secrets |
| Database | TBD | Must support JSON columns for loose fields |

Frontend framework, database engine, and host are **not yet chosen** — nothing in this
architecture depends on those choices.

---

## Subsystem 1 — Profile

Holds what the board knows about the business and renders the cached prefix.

**The constraint that shapes it:** prompt caching requires the prefix to arrive
**byte-identical** on every call, but the profile is designed to grow over time. Versioning
resolves the conflict.

```
profile edited ──► mint version N+1 ──► render prefix ONCE ──► store bytes + token count
                                                                      │
requests ──────────────────────────────────────────────────────► read stored bytes
```

Rendering happens at **write** time, never in the request path. A prefix rebuilt per
request varies and never hits cache — that costs roughly ten times more input, and nothing
visibly fails.

**Build-time assertion:** the rendered prefix must exceed **4096 tokens**, measured with
`count_tokens`. Below that, Haiku 4.5 silently declines to cache and bills full price with
no error. The floor is not the same across models (Opus 5: 512, Sonnet 5: 1024, Haiku 4.5:
4096), and Haiku is where most calls go.

---

## Subsystem 2 — Documents

```
upload PDF ──► Claude document block ──► structured extraction (every line item)
                                                    │
                                                    ▼
                                        arithmetic validation
                                   (assets = liabilities + equity,
                                    subtotals sum to totals)
                                                    │
                                    ┌───────────────┴───────────────┐
                                    ▼                               ▼
                            reconciles                       doesn't reconcile
                                    │                               │
                                    ▼                               ▼
                        show figures to owner  ◄──────────  surface the discrepancy
                                    │
                     ┌──────────────┴──────────────┐
                     ▼                             ▼
              owner confirms                owner corrects
                     │                             │
                     └──────────────┬──────────────┘
                                    ▼
                        confirmed — advice may now be generated
```

**No advice is ever generated from unconfirmed figures.** Advice built on a misread balance
sheet is worse than no advice: it is convincing and wrong, and the owner has no way to
notice.

Every line item is extracted on the first pass, not just totals. Use Case C ("where did the
money go") is a line-item question; extracting summaries only would force a full PDF
re-send on the product's most important query.

---

## Subsystem 3 — Advice Engine

```
question ──► classify task type (cheap, near-deterministic)
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   routine       advisory      hardest
   Haiku 4.5     Sonnet 5      Opus 5
        │            │            │
        └────────────┼────────────┘
                     ▼
        [persist input_state BEFORE the call]
                     ▼
              call Claude (streaming)
                     │
     ┌───────────────┼───────────────┬──────────────┐
     ▼               ▼               ▼              ▼
  normal      out of credits    refusal      network error
     │               │               │              │
     ▼               ▼               ▼              ▼
  stream       friendly msg     clear msg      retry / message
  to screen    + resume link    (not blank)
```

**Classification happens up front.** A cheap model is a poor judge of its own competence —
asked "can you handle this?", it answers yes. Task-type classification is near-deterministic
and much more reliable.

**Streaming is required, not optional.** The first read can take minutes. A spinner for two
minutes reads as a hang and the owner reloads.

**`stop_reason: "refusal"` must be checked before reading content.** Unhandled, it renders
as a blank response with no error — a silent failure.

---

## Subsystem 4 — Commitments

```
recommendation ──► commitment (due date, 5 states)
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
  computed on every render          scheduled sweep (daily)
  "what is overdue right now"        GitHub Actions → POST /api/sweep
        │                                   │  (shared secret)
        ▼                                   ▼
  shown when owner opens app          email for each overdue item
                                            │
                                    idempotency key:
                                 commitment_id + scheduled_for
                                 (two runs, one email)
```

Two things the original plan conflated: **computing** what is overdue (the UI needs it on
every render, scheduler or not) and **notifying** without the app being open. Only the
second needs infrastructure.

`overdue` is derived, never stored. Due dates resolve in the **owner's** timezone; using the
server's produces nudges a day early or late, silently.

---

## Subsystem 5 (cross-cutting) — LLM Layer

| Concern | Behavior |
|---------|----------|
| Provider abstraction | One interface; provider is a config value. Claude only for now. |
| Routing | By task type, decided before the call |
| Caching | Prefix read from `profile_versions.rendered_prefix` |
| Compression | At write time only, never in the request path. **Never applied to a document under analysis** — contract risk lives in the fine print, and in employee chat the tone is the signal. |
| Spend tracking | Accumulated from the `usage` object on every response. Cost **visibility**, not protection. |
| Credit exhaustion | Persist-before-call, friendly message, manual resume |

**The app does not hard-stop on budget.** The owner runs other applications on the same
Anthropic key, so a per-app threshold can never fire before a shared balance reaches zero.
Real protection is auto-reload configured in the Anthropic console, outside this codebase.
Recommended alongside: a separate API key in its own workspace, so this app's spend is
isolated and it cannot drain the others.

---

## Security Architecture

| Surface | Control |
|---------|---------|
| `/api/sweep` | Shared secret, stored in GitHub Secrets and host env vars. Survives the move to host cron. |
| Data scoping | `owner_id` on every table; every query filters on it. A test asserts no unscoped read. |
| API keys | Environment variables. Encryption at rest becomes a requirement when the close circle joins. |
| Auth UI | None. Schema is ready; the UI waits for the second user. |

---

## Failure Modes

Three failures are **silent** — no error, no visible symptom — and each is closed by one test:

1. **Prefix under 4096 tokens** → caching never engages, full price forever, nothing breaks
2. **Unhandled `stop_reason: "refusal"`** → blank response that looks like a bug
3. **Timezone-boundary due dates** → follow-ups fire a day early or late

Full table in the design doc's Engineering Review section.

---

## Scaling Characteristics

Not a concern at POC scale (one owner, tens of commitments, a handful of documents). The
decisions that *would* matter at scale — `owner_id` scoping, versioned prefixes,
idempotency keys — are already in place because each was cheaper to build now than to
retrofit, not because scale is expected.

---

**Last Updated:** 2026-08-08
**Locked by:** `/plan-eng-review`
**Source:** `~/.gstack/projects/BoardofAdvisors/abraham-unknown-design-20260808-001241.md`
