# PROJECT CONTEXT (English)

> Living document. Every conclusion reached during gstack sessions gets written here.
> The chat is not the source of truth. This file and `/docs` are.
> Spanish mirror: `PROJECT_CONTEXT_ESP.md`

**Project:** Board of Advisors
**Started:** 2026-08-07
**Owner:** Abraham
**Status:** Discovery / brainstorming (no code written)

---

## 1. Raw Idea (as stated by the owner, 2026-08-07)

An application that uses AI (via the Claude API) to create a **Board of AI Advisors**
that gives recommendations about real situations happening inside the owner's company.
Advice spans finance, marketing, operations, administration, and more.

The core bet: the board is only useful if it has **live data** about the business.
So the app connects to external systems:

- **QuickBooks** — P&L, balance sheet, cash allocation. Feeds the financial advisor.
- **WhatsApp** — specific, owner-selected chats. The owner supplies a roster of
  employees (name, position, department, function) so the board knows *who* is
  writing and *why* when a message arrives.
- **Project management app** — full picture of how each project is being executed.

### Interaction model
- The board is made of **individual specialists**.
- The owner can talk to **one advisor at a time** (1:1 chat).
- The owner can also open a **group chat** where every relevant advisor answers
  from their own specialty.

### Nightly digest
Every night the board compiles everything ingested that day and produces:
- A 3-paragraph summary of what happened
- Problems detected
- Recommended solutions
- Suggested next actions

### Onboarding / business memory
At setup, the owner describes the business: what it does, strengths, weaknesses,
current worries, ideas about what is missing. This becomes persistent context for
every advisor.

### Reporting
The board can write a report on request, meant to be presented to employees.
Reports must support charts and pull real data the system has collected.

---

## 2. Business Model (as stated)

- **End state:** commercial web app, subscription-based (SaaS).
- **Proof-of-concept stage:** free to use, but the user must supply their **own API
  keys** for every external service (Claude, QuickBooks, etc.) so the owner does not
  pay for other people's usage.

---

## 3. Product Constraints (as stated)

- **UI must be multi-language.** The owner gives instructions in Spanish; the app
  itself must let the end user pick a language.
- **Engineering documentation is written in English.**
- **A GitHub repository will be created** to store the project.
- Every important conclusion is recorded in `/docs` and in this file.

---

## 4. The Company (context gathered 2026-08-07)

- **Size:** 4 people in the office + one installation crew.
- **Project profile:** many projects running at once, each one small.
- **Financial state:** tight cash flow. A lot of money committed inside active
  projects, slow recovery. Limited budget and reserves.
- **Strategic tension:** wants to grow into larger, more complex projects, but has
  neither the staff nor the capital to hire ahead of demand.
  - Hire first, lose the bid → burns salary and training money for nothing.
  - Win the bid first, hire after → no time to recruit and train before kickoff.

### Real decisions the owner named (verbatim use cases)

**Use Case A — Growth / hiring risk**
"Should we invest in staff now, take the risk of not hiring until we win the project
and then rush training, or not go after this class of project at all until we have
more cash in the bank?"
- Data required: bank balance, capital committed to active projects, expected
  collection dates, pipeline of future projects that require investment.
- Source: QuickBooks covers most of this. **Three numbers and a collections calendar,
  not the whole general ledger.**

**Use Case B — Contract risk**
A trusted client offers a contract loaded with penalty and legal clauses covering
occupational safety, accidents, staff misconduct, and delays. Normally the owner
would not sign. The client is known and trusted; the clauses are believed to be
defensive against bad actors rather than predatory. Question: is the risk worth it?
- Data required: **none from any connected system.** This needs document analysis,
  business context, and judgment.

---

## 5. Decisions Made

*(Appended as the session progresses. Format: date, decision, rationale.)*

| # | Date | Decision | Rationale |
|---|------|----------|-----------|
| D-001 | 2026-08-07 | Build incrementally: real MVP first, then grow toward the full platform. | Owner confirmed the full vision is not the first release. |
| D-002 | 2026-08-07 | Proof of concept is for the owner plus a close circle only. Not public. | Removes scale, billing, and multi-tenant pressure from v1. |
| D-003 | 2026-08-07 | Do NOT build on unofficial WhatsApp libraries (whatsapp-web.js, Baileys). | They read personal chats as desired, but violate WhatsApp ToS, risk number bans, and break on Meta changes. Unshippable in a commercial product. |
| D-004 | 2026-08-07 | WhatsApp ingestion for MVP = **Option 4, manual chat export (.txt) + upload**. | Owner's explicit choice. Zero cost, zero legal gray area, works today. Telegram Bot API (Option 5) is the v2 upgrade path. |
| D-005 | 2026-08-07 | LLM budget ceiling: **$5/month is comfortable, $30/month is not**. | Owner stated directly. Drives the model-routing decision below. |
| D-006 | 2026-08-07 | **Route by task tier, don't pick one model.** Haiku 4.5 for routine work (chat-export parsing, data extraction, nightly digest drafting), Sonnet 5 for advisory reasoning, Opus 5 only for the hardest judgment calls. | Haiku is 1/5 the price of Opus. ~80% of the workload is routine. Keeps the monthly bill inside the stated ceiling. |
| D-007 | 2026-08-07 | **Do not add a second LLM provider for the POC.** Build a thin model-abstraction layer instead so the provider is a config change. | At one user and ~$10/month, a second provider is engineering cost for near-zero savings. The abstraction layer is cheap now and makes the switch trivial later. |
| D-008 | 2026-08-07 | **Prompt caching is a first-class architectural requirement, not an optimization.** The business-context prefix must be stable and cacheable. | Cache reads cost ~10% of normal input price. The "board that knows your business" re-sends that context on every single call — without caching this is the dominant cost line. Confirmed by owner. |
| D-009 | 2026-08-07 | **Model escalation must be automatic.** The system decides on its own whether Haiku can handle the request or it must escalate. | Owner's explicit requirement. Two mechanisms: (a) Claude's **advisor tool** — cheap executor + capable advisor consulted mid-generation; (b) a cheap Haiku pre-classification call that routes by question tier. See §6d. |
| D-010 | 2026-08-07 | **Nightly digest runs through the Batch API (50% cheaper).** | The digest has zero latency requirement — it runs overnight and is read in the morning. It is also the single most expensive call of the day (processes the whole day's context). Batch is a free 50% saving here. |
| D-011 | 2026-08-07 | **Budget alerting is a product requirement:** warn at 90% consumed, act at 100%. | Owner's explicit requirement (stated as 10% remaining / 100% consumed). Implementation note: the Anthropic API does **not** push balance notifications — the app must accumulate spend itself from the `usage` object on every response. |
| D-012 | 2026-08-07 | Model-provider abstraction layer from day one. Swapping providers = editing a config file, not rewriting the app. Claude only for now. | Confirmed by owner (supersedes nothing; formalizes D-007). |
| D-013 | 2026-08-07 | **Context compression (Headroom) runs at WRITE time, never at request time.** Compress the stable business context once, store the compressed form, use that as the cached prefix. | Compression at request time yields a varying prefix, which destroys cache hits. See §6e — compression that breaks the cache is *worse* than caching alone. |
| D-014 | 2026-08-07 | **Never compress the document under analysis.** Compression applies to bulk/structured payloads only (chat exports, QuickBooks dumps, logs). | "Zero accuracy loss" is credible for code (AST reduction is semantically equivalent) and JSON. It is a far stronger claim for natural language. In contract risk review the risk lives in the fine print; in employee chat the tone and the hedge are the signal. |
| D-015 | 2026-08-07 | **Target segment: businesses of 1–15 people, any industry.** | The common thread is not industry — below ~15 people the owner *is* the entire management layer. No CFO, no COO, no board, no peer. That void is what the product fills. |
| D-016 | 2026-08-07 | **Do not build vertical business logic. Build vertical-aware onboarding questions.** | The LLM already carries the domain knowledge (restaurant prime cost, construction retainage, agency utilization). What's missing is the right questions to connect that knowledge to *this* company. Explicitly agreed by owner. |
| D-017 | 2026-08-07 | **Onboarding is a conversational interview run by ONE advisor**, with a completeness checklist tracked underneath and a visible progress indicator. | A 30+ field form gets abandoned. Free-form conversation doesn't guarantee coverage. One interviewer (chief-of-staff persona) avoids overwhelming the user and introduces the multi-advisor concept gently. |
| D-018 | 2026-08-07 | **Onboarding is propose-and-correct, not ask-and-type.** The system reads the company website and uploaded financial statements, drafts a profile, and asks the owner to correct it. | Correcting is ~10× faster than composing, and it produces the "magic" moment inside the first three minutes. |
| D-019 | 2026-08-07 | **Onboarding is tiered. Tier 1 = 15–20 minutes, unattended. Everything else accretes on demand.** | Owner's constraint: 15–20 min, no hand-holding. The full data wishlist (per-employee name/role/salary/schedule) is 50+ data points for a 10-person company — 20 minutes by itself. |
| D-020 | 2026-08-07 | **Collect each data point at the moment it becomes necessary, not up front.** Employee roster when the first chat is connected; salaries when the first payroll/cash question arises. | Keeps Tier 1 short and reinforces the Initiative pillar: the board asks for what it needs, when it needs it. Onboarding never "finishes" — that is a feature. |
| D-021 | 2026-08-07 | **First deliverable is an uninvited diagnostic, not a summary of what the system understood.** Run the cash-vs-profit reconciliation (Use Case C) against the just-uploaded financial statements. | A summary is a mirror, not value — the owner already knows what his business does. The diagnostic uses data already given, demonstrates all three pillars at once, and is falsifiable. |
| D-022 | 2026-08-07 | **The first session must create the first tracked commitment.** | Otherwise the Accountability pillar is theoretical. The follow-up loop has to start on day one. |
| D-023 | 2026-08-08 | **Add Use Case D — direction / agenda-setting** as a first-class use case, distinct from A/B/C. | Owner correction. A–C are "I have a specific question"; D is "I don't know what the question is." D is what a real board does that a one-off consultant does not. |
| D-024 | 2026-08-08 | **Premise 1 reworded: value is expert guidance grounded in this business; defensibility is follow-through. Neither alone suffices.** | The original wording collapsed the product into its most defensible pillar and lost its primary value. If it had reached `/plan-eng-review` unrevised, the data model would have been optimized for commitments with expert guidance treated as generic chat on top. |
| D-025 | 2026-08-08 | **Build for the owner first; commercialization is secondary.** Start building without the two-week validation task. | Owner's decision, and the reasoning holds: he is the user, so demand does not need discovering. Premises 2 and 5 become DEFERRED, not falsified — they gate selling, not building. |
| D-026 | 2026-08-08 | **Privacy flags (salary storage, employee consent) are near-zero risk while single-tenant, and return in full the moment a second company's data enters the system.** Do not delete them from Open Questions. | His company, his data, his call. The obligation is not gone, it is dormant. |
| D-027 | 2026-08-08 | **Scope cut from 6 subsystems to 4.** Deferred: nightly digest, WhatsApp export ingestion, multi-advisor chat UI, multi-language UI, API-key encryption, Headroom. | The nightly digest has no daily data source in Approach A — it would summarize nothing. The conversational onboarding serves future users, not the owner. Neither defers any learning. |
| D-028 | 2026-08-08 | **Financial statements: native Claude PDF extraction + arithmetic validation + visible confirmation before any advice.** No parsing library. | Extraction is Premise 4's critical path, not an edge case. A misread balance sheet produces convincing, wrong advice with no way for the owner to notice. |
| D-029 | 2026-08-08 | **Follow-up: computed on every render (always), plus a GitHub Actions scheduled call to one authenticated endpoint.** Host cron replaces the trigger at commercialization. | Free-tier cron fails silently, and the accountability pillar failing silently would be read as a product failure. The sweep must be trigger-agnostic so the swap is cheap. |
| D-030 | 2026-08-08 | **`owner_id` on every table from day one; zero auth UI.** | "Single-tenant" contradicted "owner plus close circle." The column costs nothing now and a migration on real data later. Same reasoning as first-class commitment entities. |
| D-031 | 2026-08-08 | **Cached prefix is an immutable versioned snapshot, rendered at write time, with a build-time test that fails under 4096 tokens.** | Byte-stability and an evolving profile conflict; versioning resolves it. Below 4096 tokens Haiku 4.5 silently declines to cache and bills full price with no error. |
| D-032 | 2026-08-08 | **No app-side budget hard stop. Count and warn only. Persist state before every model call; on credit exhaustion show a friendly message and resume manually after top-up.** | Owner correction: he runs other apps on the same Anthropic key, so a per-app 90% alert can never fire before a shared balance hits zero. Real protection is auto-reload in the Anthropic console. |
| D-033 | 2026-08-08 | **Commitment states: pending, done, overdue, deferred (new date), dismissed (reason required).** `overdue` is computed, never stored. | `status` was referenced but never defined. `dismissed_reason` is the highest-signal field in the system — the record of which advice was rejected and why. |
| D-034 | 2026-08-08 | **Advisors: shared base + per-advisor delta (name, expertise, data access, and what it is explicitly NOT for).** Finance defined now; the rest are names until first asked. | Self-contained persona files duplicate the business context and desynchronize. `not_my_job` prevents a finance advisor opining on a contract with false confidence. |
| D-035 | 2026-08-08 | **Every recommendation stores advisor config version and model used, alongside source message and data snapshot.** | Without them you cannot distinguish a bad recommendation caused by bad data from one caused by a bad prompt. Not reconstructable after the fact. |
| D-036 | 2026-08-08 | **The sweep endpoint authenticates with a shared secret** (GitHub Secrets + host env). | It is reachable from the internet. Unauthenticated, anyone who finds it can trigger it or read commitment data. |
| D-037 | 2026-08-08 | **Extract every line item from financial statements on the first pass, not just totals.** | Use Case C is a line-item question. Extracting summaries only would force a full PDF re-send on the product's most important query, at ~10× the cost. |
| D-038 | 2026-08-08 | **The first read streams to the screen.** | It can take minutes. A spinner that long reads as a hang and the owner reloads. |
| D-039 | 2026-08-10 | **Chat threads (and paragraph comments) live in the app DB**, same as commitments. File export/import to a local folder is optional backup, not the source of truth. | Browser cache gets cleared; watching a disk folder is fragile (permissions, paths, browsers can't do it well). Confirmed by the owner. |

---

## 6. KEY INSIGHT #1 (EUREKA) — 2026-08-07 — REVISED

**Original claim:** live data integration is not the core value; it's one input.

**Owner pushed back with a counter-example, and was right.** Use Case C below needs
the *full* accounting picture, not a thin slice. The claim was over-corrected.

### Use Case C — Cash/profit reconciliation (owner's counter-example)
"My accounting system says I have $50,000 in profit year-to-date, but I only have
$3,000 in the bank and $10,000 in receivables. Where is the rest of the money?"

This is the classic small-business cash-vs-profit gap. The answer lives in what the
P&L does **not** show: inventory, receivables, owner draws, debt principal payments,
capital expenditures. A financial advisor that runs this reconciliation automatically
is genuinely valuable — and it requires deep QuickBooks access, not three numbers.

### Use Case D — Direction / agenda-setting (added 2026-08-08 after owner correction)

> *"A veces no sé qué se debe hacer ante X circunstancia, y quiero poder preguntar al
> board que me diga ahora qué hay que hacer para avanzar, o en base a su conocimiento e
> información de la empresa que me hagan un plan de cómo podemos aumentar nuestras
> ventas un 5%, o consejos de en qué estamos gastando mucho dinero que no es necesario
> y cómo mejorar utilidad."*

**Structurally different from A, B, and C.** Those are all "I have a specific question."
D is "I don't know what the question is." A–C are decision support; D is **agenda
setting** — and it is the mode a solo owner has no access to at all. It is what a real
board does that a consultant hired for one question does not.

Data required: the full business context plus whatever financial and operational data is
connected. Spans all three tiers below rather than sitting in one.

**Why this was nearly missed:** it was initially folded into the Initiative pillar as a
sub-bullet. The owner corrected this — the guidance/direction half is the *primary
value*, not a side effect of proactivity. See the revised framing in §6b.

### Corrected framing: questions come in tiers, and each tier needs different depth

| Tier | Example | Data required |
|------|---------|---------------|
| 1. Judgment | Use Case B — the penalty-clause contract | **None** from any system. Document + business context |
| 2. Cash decision | Use Case A — hire now or after winning the bid | Three numbers and a collections calendar |
| 3. Forensic | Use Case C — where did the money go | **Full accounting picture** |

**What survives from the original insight:** the *build order*. A version that requires
three integrations before delivering any value never ships. Start at Tier 1 (usable
day one), then Tier 2, then Tier 3.

**What changed:** Tier 3 is a real destination, not scope creep. Deep QuickBooks
integration is on the roadmap, just not first.

---

## 6b. KEY INSIGHT #2 (EUREKA) — 2026-08-07 — THE PRODUCT DEFINITION

**This is the most important conclusion of the session.**

Asked what he does today when a hard decision arrives, the owner answered:

> *"No le pregunto a nadie, la decisión la tomo yo a puro instinto."* (I ask nobody. I
> decide on pure instinct.)
> *"Pueden pasar una semana, 2 o 3."* (Decisions take one to three weeks.)
> *"Más que no tener a quién consultarle es no tener alguien que me guíe **después** de
> tomar la decisión."* (The bigger gap isn't having nobody to consult — it's having
> nobody to guide me **after** the decision is made.)

Asked why he doesn't just paste the contract into Claude.ai:

> *"Claude no tiene el panorama completo, y no puedo ponerme a explicarle cada vez."*
> *"Si les pido que todos los lunes me manden X reporte automáticamente sin yo tener
> que solicitarlo."*
> *"Que a los 10 días me pidan información de lo que solicitaban, y si no está hecho,
> **insistan** en la importancia de por qué hay que hacerlo."*

**The product is not a chatbot. It is an accountability system with memory and its own
agenda.** Three pillars:

1. **Memory** — knows the business; the owner never re-explains anything.
2. **Initiative** — speaks first. Scheduled reports, unprompted observations, agenda
   items the owner didn't think to ask about ("here's a plan to raise sales 5%",
   "here's where you're overspending").
3. **Accountability** — remembers what it recommended, tracks the commitment, and
   follows up. If the thing isn't done by the deadline, it asks again and restates
   why it matters.

**Pillar 3 is the hardest to copy. It is not the most valuable.** — *corrected
2026-08-08.*

The original version of this section said "Pillar 3 is the moat" and collapsed the
product into it. The owner corrected that:

> *"La app no es sólo para obligarme a dar seguimiento, es para darme dirección cuando no
> sé cómo actuar y me ayude según la experiencia de expertos en distintos temas a darme
> una respuesta y una guía para ayudarme a fortalecer y crecer mi empresa."*

**Value and differentiation are separate questions:**

| Question | Answer |
|----------|--------|
| Why open the app at all? | Expert judgment across finance, marketing, ops and admin, applied to *this* business — plus direction when the owner doesn't know what to do (Use Case D) |
| Why this and not Claude.ai, which he already has? | Memory (never re-explain), initiative (it speaks first), follow-through (it comes back) |

Guidance without memory is Claude.ai. Memory without follow-through is a better notebook.
Follow-through without good guidance is nagging. **The product is all three.**

Claude.ai has none of the three. Most "AI advisor" products have, at best, the first.
Nobody ships the third — which is why it is the most defensible, even though the reason
a user opens the app is the guidance.

> An advisor who gives you advice and never asks again is not an advisor, it's a
> search engine. But an advisor who only nags and has no expertise is not an advisor
> either — it's a calendar.

**Consequence:** the data model needs first-class objects for **recommendations**,
**commitments**, and **follow-up state** — not just messages. This is an architectural
requirement, not a feature to bolt on later.

---

## 6c. LLM Cost & Model Selection Analysis — 2026-08-07

Anthropic API pricing, per million tokens (verified against current docs 2026-08-07):

| Model | Input | Output | Context |
|-------|-------|--------|---------|
| Claude Haiku 4.5 | $1.00 | $5.00 | 200K |
| Claude Sonnet 5 | $3.00 | $15.00 | 1M |
| Claude Opus 5 | $5.00 | $25.00 | 1M |

**Estimated monthly cost, single user, ~10 queries/day + nightly digest:**

| Strategy | Estimate |
|----------|----------|
| All Haiku 4.5 | $3–5/month |
| Routed (Haiku routine, Sonnet advisory) | $8–12/month |
| All Opus 5 | $20–25/month |

*Assumptions: ~5K-token stable business-context prefix (cached), ~1K new input and
~1K output per query, ~20–30K input for the nightly digest. Re-baseline against real
usage before treating these as budget numbers.*

### Prompt caching — the dominant cost lever for this product

Cache reads cost ~10% of normal input price. Cache writes cost 1.25× (5-minute TTL) or
2× (1-hour TTL). Because the business-context prefix is re-sent on every call, caching
turns the "board that knows your business" from the biggest cost line into a rounding
error.

**Design constraint that follows:** the cached prefix must be **byte-stable**. No
timestamps, no UUIDs, no per-request interpolation ahead of the stable content — any
byte change invalidates the whole prefix.

**Minimum cacheable prefix is model-dependent** and this bites silently (no error, it
just doesn't cache):

| Model | Minimum cacheable prefix |
|-------|--------------------------|
| Claude Opus 5 | 512 tokens |
| Claude Sonnet 5 | 1024 tokens |
| Claude Haiku 4.5 | 4096 tokens |

If the business-context prefix lands under 4096 tokens, it will not cache on Haiku 4.5.

### Non-Anthropic alternatives considered

Owner raised DeepSeek and flagged a data-security concern about Chinese companies.

- **DeepSeek** — the concern is legitimate for business data, but the model weights are
  open: they can be run on US-hosted inference (Together, Fireworks), which removes the
  data-residency risk entirely. It does not remove the question of whether the model
  reasons well enough about contractual and financial risk.
- **Google Gemini Flash** — has a genuine free tier via AI Studio, but free-tier data
  may be used for training. Read the terms before putting company financials through it.
- **Mistral** — French/EU, GDPR-friendly, cheap.
- **OpenAI mini models** — US, competitive pricing.

**Decision: see D-007.** No second provider for the POC; build the abstraction layer
instead.

---

## 7. WhatsApp Options Analysis (2026-08-07)

| # | Option | Sees personal/group chats? | Legal | Cost | Verdict |
|---|--------|---------------------------|-------|------|---------|
| 1 | WhatsApp Business Platform (Cloud API) | No — only messages sent to a registered business number | Yes | Free for user-initiated within 24h window | Viable, but forces a behavior change on the team |
| 2 | BSP (Twilio, 360dialog) | Same limits as #1 | Yes | Adds cost | Rejected — no added capability |
| 3 | Unofficial libs (whatsapp-web.js, Baileys) | Yes, everything | **No — violates ToS** | Free | **Rejected for the product.** Ban risk, breaks on Meta changes |
| 4 | Manual chat export (.txt) + upload | Yes, whatever the user exports | Yes — user's own data | Free | **Recommended for MVP.** Ugly, manual, works today |
| 5 | Move reporting channel to Telegram Bot API | Yes, full group access | Yes | Free | **Recommended for v2.** One week of habit change for a 4-person team |

---

## 6d. Cost-Control Architecture — 2026-08-07

Four mechanisms, all available on the first-party Claude API.

### 1. Prompt caching (D-008)
Cache reads ~10% of input price. Requires a byte-stable business-context prefix.
Model-dependent minimums: Opus 5 = 512 tokens, Sonnet 5 = 1024, Haiku 4.5 = 4096.

### 2. Automatic model escalation (D-009)

**Mechanism A — Advisor tool** (beta header `advisor-tool-2026-03-01`). Pairs a cheap
**executor** model with a more capable **advisor** model consulted mid-generation. The
executor does the bulk of token generation; the advisor is pulled in for the hard
reasoning. Proposed pairing: executor `claude-haiku-4-5`, advisor `claude-opus-5`.

> Constraint: the advisor model must be **at least as capable** as the executor.
> Haiku-executor + Opus-advisor is valid. The reverse returns a 400.
> Not available on Amazon Bedrock, Vertex AI, or Microsoft Foundry — first-party API only.

**Mechanism B — Pre-classification routing.** A short, cheap Haiku call classifies the
incoming question by tier (judgment / cash / forensic) and routes to the right model
before the real call. Simpler and cheaper than the advisor tool; the two can coexist.

### 3. Batch API for the nightly digest (D-010)
50% cheaper than standard pricing. Most batches complete within an hour, max 24. The
digest has no latency requirement, so this is a free saving on the day's biggest call.

### 4. Budget tracking and alerting (D-011)

**The Anthropic API does not notify you when credit runs low.** There is no balance
webhook. The app must track spend itself:

1. Every response carries a `usage` object: `input_tokens`, `output_tokens`,
   `cache_read_input_tokens`, `cache_creation_input_tokens`.
2. Multiply by the per-model rate for whichever model served the call.
3. Accumulate against a user-configured monthly budget.
4. Alert at 90%. Act at 100%.

**Design improvement over the original ask:** alert on **dollar budget**, not raw token
count. Tokens are meaningless to the end user; dollars are what they actually manage.

**OPEN — what happens at 100%?** Four options, owner has not decided:

| Option | Tradeoff |
|--------|----------|
| Hard stop | No overspend, but the board dies exactly when a decision is urgent |
| Degrade to Haiku only | Keeps working, cheaper, less sharp answers |
| Keep going + notify | User stays in control; risk of surprise bills |
| **Pause automation, keep chat** (recommended) | Scheduled digests/reports stop; manual chat stays alive |

---

## 6e. Context Compression — Headroom evaluation — 2026-08-07

**Tool:** Headroom, by Tejas Chopra (senior engineer at Netflix). Apache 2.0, released
January 2026. A local-first proxy that compresses context before it reaches the LLM,
using six engines including AST-aware code reduction, JSON optimization, and a
HuggingFace-based text compressor. Claims 60–95% token reduction with "zero accuracy
loss." ~39K GitHub stars in five months.

Sources: [The Register](https://www.theregister.com/ai-ml/2026/05/31/netflix-wiz-creates-app-to-slash-ai-bills-then-open-sources-it/5248702) ·
[Open Source For You](https://www.opensourceforu.com/2026/06/netflix-engineer-open-sources-ai-cost-cutting-tool/) ·
[HackerNoon](https://hackernoon.com/a-netflix-engineer-built-a-free-tool-that-cuts-your-ai-token-bill-by-88percent)

### The conflict: compression vs prompt caching

Caching works on **exact prefix match**. One differing byte invalidates everything
after it. Compressing on every request produces a varying prefix and therefore never
hits cache. The economics invert:

| Strategy | Relative input cost |
|----------|--------------------:|
| No cache, no compression | 100 |
| Cache only (read at 0.1×) | **10** |
| Compression only (88%) | 12 |
| Compression **+** cache | **1.2** |
| Compression that breaks the cache | 12 ← worse than cache alone |

**Resolution (D-013):** compress the stable context **once, at write time**; store the
compressed artifact; use it as the cached prefix. Never compress in the request path.

**Where compression genuinely pays:** the volatile payloads that never cache well
anyway — the daily WhatsApp export, the QuickBooks dump, logs.

**Where it is prohibited (D-014):** any document the board is being asked to analyze
closely. Contract risk lives in the fine print; in employee chat, tone and hedging are
signal, not noise.

---

## 6f. Onboarding Design — 2026-08-07

**Constraint (owner):** 15–20 minutes, unattended. No hand-holding session.

### Why it must be tiered
The owner's full data wishlist — business description, client types, project types,
day-to-day operations, legal structure, headcount, and per employee name / role /
function / salary / schedule, plus problems, strengths, and competitors — is 50+ data
points for a 10-person company. The employee roster alone consumes the whole budget.

### Tier 1 — the 15–20 minutes
- What the business does, who buys, what a typical project looks like
- Size and rough structure: headcount and functions. **No names or salaries yet.**
- The three things keeping the owner up at night
- Upload of financial statements (multiple years preferred — owner's suggestion)
- Competitors: names and URLs only; the system researches them

### Tier 2 — accretes on demand (D-020)
- Employee roster with names/roles → requested when the first chat source is connected
- Salaries → requested the first time a payroll or cash question arises
- Schedules → requested when the first operations question arises

### Mechanics
- **One interviewer, not the whole board** (D-017). A chief-of-staff persona conducts
  the interview and then introduces the team. A seven-advisor group interview is
  overwhelming.
- **Conversation on top, checklist underneath** (D-017). The interview adapts — skips
  what was already inferred, presses where an answer was vague — while a completeness
  checklist drives coverage and a progress indicator shows what remains.
- **Propose, don't ask** (D-018). Ingest the company website and the uploaded
  statements, draft the profile, then show it: *"this is what I understood — correct
  what's wrong."*

### First-run deliverable — "The board's first read" (D-021, D-022)
Not a summary of what the system understood; that is a mirror, not value. Instead, run
the cash-vs-profit reconciliation (Use Case C) against the just-uploaded statements and
return one page:

1. **Three observations**, each anchored to a real number from the statements. Not
   "your margins could improve" — rather *"profit is up 18% but receivables are up 40%:
   you are selling more and collecting worse."*
2. **One question** the board needs answered to go deeper — establishes that the
   relationship is two-way.
3. **One recommendation with a date**, which becomes the first tracked commitment.

**The bar:** the owner should want to tell someone what the board told him. If the
first read is generic, the product is dead in minute one.

---

## 7b. THE CRITICAL ASSUMPTION — horizontal vs vertical — 2026-08-07

Owner's position on who the product serves:

> *"Es muy probable que cada usuario tenga un negocio diferente, pero lo que sí deben
> tener en común es que es para negocios pequeños de 1 a 10 o 15 personas."*
> *"La afilada viene de la información que el usuario le vaya a brindar al sistema."*

This is the **horizontal** bet: the product does not specialize by industry. It
specializes **per user**, via the business context each one loads. No customer's data
is in another customer's system.

**This is not a naive position.** With traditional software, building per-vertical logic
would be prohibitive. With an LLM, financial, operational, and risk reasoning genuinely
generalize better than most software does. The bet has real foundation.

**But it contains the single most critical assumption in the product:**

> **That a generic advisor, fed user-supplied context, produces sharp advice — rather
> than generic advice with the user's names substituted in.**

The concrete risk: a financial advisor for an installation contractor reasons about
retainage, progress billing, and job costing. For a restaurant it's food cost
percentage, prime cost, and waste. For an agency it's utilization and realization rates.
If the advisor persona prompts are generic, all three may receive the same textbook
answer, useful to none of them.

**Status: UNTESTED in either direction.** This is cheap to test without building
anything (see The Assignment). If this assumption fails, the whole product fails — so
it gets tested before code is written.

---

## 8. Open Questions

*(Live list. Items move to Decisions once resolved.)*

- Who is the second customer, after the owner? *(Owner 2026-08-07: not yet chosen.
  Likely different industries each, all in the 1–15 person range — see D-015.)*
- **Claude API has no free tier.** Estimated $5–30/month for a single user
  (daily chat + nightly digest). Everything else (hosting, DB, auth, QuickBooks
  sandbox) can be free. How is this reconciled with the "must cost nothing" constraint?
- What is the narrowest version that delivers value in week one?
- Which project management tool specifically?
- Does the nightly digest or the live chat carry the real value?
- Which advisor personas actually matter for a 4-person contracting business?

### Legal / privacy — flagged 2026-08-07, route to `/cso`

These are **not blockers for the POC** (single owner, own company, own data) but they
change the architecture if deferred past it. Decide before the product is sold.

- **Per-employee salary storage.** The owner's data wishlist includes name + salary per
  employee. On a multi-tenant SaaS this is sensitive employment PII: it raises the bar on
  encryption at rest, access control, audit logging, and breach exposure. Decide whether
  salaries are stored as figures, as bands, or derived on demand from QuickBooks payroll
  without persisting.
- **Employee consent for chat ingestion.** Employees did not consent to having their
  messages processed by AI. In the owner's own company he can make that call. Once this
  is a product sold to *other* owners, each customer is uploading third-party
  conversations into the vendor's system, and the liability is no longer only theirs.
  Needs a stance (consent flow, notice requirement, or a documented customer obligation)
  and a jurisdiction check — the owner's company appears to operate in Latin America,
  so local data-protection law applies, not just GDPR/CCPA.

---

## 6. Risks Flagged Early

- **WhatsApp access is the single biggest technical/legal unknown.** The official
  WhatsApp Business Platform does not expose arbitrary personal or group chats.
  If the plan depends on reading normal employee chats, that assumption needs to be
  verified before anything else gets built.
- **Bring-your-own-API-key onboarding is heavy friction.** Asking a non-technical
  business owner to obtain and paste Claude + QuickBooks credentials before seeing
  any value is a well-known conversion killer.
- **Scope is platform-sized, not MVP-sized.** Three integrations, multi-agent chat,
  nightly digest, and chart-generating reports is not a first release.

---

## 9. Status: Completed / Pending

### ✅ Completed

**Session 2026-08-08 — /plan-eng-review + Repository & Business Context**

**Engineering Review decisions closed:**
| # | Date | Decision |
|---|------|----------|
| D-027 | 2026-08-08 | **Scope cut from 6 subsystems to 4.** Deferred: nightly digest, WhatsApp export ingestion, multi-agent chat, multi-language UI, API-key encryption, Headroom. |
| D-028 | 2026-08-08 | **Financial statements: native extraction with Claude + arithmetic validation + visible confirmation before any advice.** No parsing library. |
| D-029 | 2026-08-08 | **Tracking: calculated on every render (always) plus scheduled GitHub Actions call to authenticated endpoint.** Server cron replaces trigger at scale. |
| D-030 | 2026-08-08 | **`owner_id` column in every table from day one; zero auth UI.** "Single tenant" contradicted "owner plus inner circle." Cost nothing now, migration cost later. |
| D-031 | 2026-08-08 | **Cached prefix is an immutable versioned snapshot, rendered at write, with a test that fails if under 4096 tokens.** |
| D-032 | 2026-08-08 | **No hard budget brake in the app. Count and alert only.** Save state before every model call; on zero credits, clear message + manual recovery after reload. |
| D-033 | 2026-08-08 | **Commitment states: pending, done, overdue, rescheduled (new date), dismissed (reason required).** `overdue` is calculated, never stored. |
| D-034 | 2026-08-08 | **Advisors: shared base + per-advisor delta** (name, specialty, what data they see, what's NOT their domain). Finance defined now; rest are names until first query. |
| D-035 | 2026-08-08 | **Every recommendation saves the advisor config version and model used** alongside origin message and data snapshot. |
| D-036 | 2026-08-08 | **Sweep endpoint authenticates with shared secret** (GitHub secrets + hosting env vars). |
| D-037 | 2026-08-08 | **Extract all detail rows from the financial statement on first pass,** not just totals. |
| D-038 | 2026-08-08 | **First reading streams to screen while generating.** May take minutes. Spinner for two minutes reads like hung. |

**Architecture findings closed:**
- H5: Model layer — resolved in D-030/034
- H6: State machine — resolved in D-033
- H7: Advisor structure — resolved in D-034
- H8: Version tracking — resolved in D-035
- H9: Endpoint security — resolved in D-036

**Performance findings closed:**
- H9: First-reading streaming — resolved in D-038
- H10: Financial statement reuse — resolved in D-037

**Artifacts generated (08-08):**
- Design doc: 10 findings, test map, failure modes, 13 tasks
- docs/06-SYSTEM-ARCHITECTURE.md: 5 subsystems with diagrams
- docs/07-DATA-MODEL.md: full schema with state machine
- Test plan + tasks JSONL: ~/.gstack/projects/BoardofAdvisors/
- **BUSINESS_CONTEXT.md**: Complete Siscon company profile (revenue, team, financials, constraints)
- **GitHub repo**: https://github.com/agoldav/board-of-advisors (initialized, README + gitignore + LICENSE)

**Test coverage map:** 19 paths, 4 critical

---

**Session 2026-08-09 — Implementation Tasks 1–3 (built in Cursor)**

**Stack decision:**
- **TypeScript + Node, raw SQL with `pg` (no ORM), luxon for timezone-aware dates.**

**Task 1 — Database schema (commit `8202b5c`):**
- `db/migrations/0001_initial_schema.sql`: 11 tables, 8 enums, indexes and constraints. PostgreSQL, schema only.
- `owner_id` on every table (D-030); 4096-token floor CHECK on `profile_versions` (D-031); `overdue` never stored and dismiss requires reason (D-033); recommendation traceability set (D-035); line-item `extracted_figures` (D-037); `input_state` on `llm_operations` for persist-before-call (D-029).

**Task 2 — Backend core (commit `be220ec`):**
- Business profile: byte-stable render + versioning service with real tokenizer floor (D-008/D-031).
- Model router: classify then route → Haiku/Sonnet/Opus (D-006/D-009); first read → Opus (D-021). Anthropic client with `cache_control`, streaming, `count_tokens`, `usage`, `refusal` handling.
- Commitment state machine: validated transitions; `overdue` computed on read in the owner's timezone (D-033).

**Task 3 — Advisor engine (commit `d13fc55`):**
- `askAdvisor` (1:1 chat) and `firstReading` (streamed cash reconciliation — D-021/D-038).
- Persist-before-call with friendly out-of-credits message (D-029); full recommendation traceability (D-035).
- Versioned YAML advisor configs (finance complete, operations stub) + registry (D-034).
- Pure reconciliation helpers (D-021/D-037).

**Verification:** 32 unit tests green; strict `tsc` clean.

---

**Session 2026-08-09 — Tasks 4, 8, 13 + PR #1 + GitHub ops**

**Task 4 — PDF ingestion (D-028 / D-037):**
- Native Claude extraction (document block + forced tool); every line item.
- Arithmetic validation; confirm / correct / reject before any advice.
- First-read guard: no advice if the balance sheet does not reconcile.

**Task 8 — Commitment sweep (D-029 / D-036):**
- `POST /api/sweep` with shared-secret auth; one email per overdue commitment per day (idempotent).
- Daily GitHub Actions workflow included in the PR.
- GitHub secret `SWEEP_SHARED_SECRET` created by the owner.

**Task 13 — Spend counter (D-032):**
- Accumulates from `llm_operations.usage`; warn at ≥90% / signal at ≥100%; no hard cutoff.

**Delivery / repo:**
- Pull request **merged** (2026-08-09): https://github.com/agoldav/board-of-advisors/pull/1 → `main` (`8da7017`).
- `BUSINESS_CONTEXT.md` updated and included in the PR (context the app must use for advice).
- Local rule `.cursor/rules/secrets-handling.mdc`: never push secrets; public docs use `********` + “see local files”.
- `gh` installed and authenticated; dedicated token for this app.
- Verification: 61 unit tests green; strict `tsc` clean.

---

**Session 2026-08-10 — UI: design, React shell, thread agreements**

**Design:**
- Brief for Claude Design: `docs/19-CLAUDE-DESIGN-BRIEF.md` (also under `UI Design/`).
- Design handoff received in `UI Design/` (README + standalone + source); direction **1a** (persistent rail) adopted for data/conversation.

**UI implemented (`web/` — React + Vite):**
- Screens: Figure confirmation, First reading, Chat, Commitments.
- Shared shell: left rail + ask bar; light default and dark.
- Settings opened by clicking the owner name (bottom left); theme selector lives there.
- Fixture/example data so the app can be browsed before wiring the backend.
- Try at: http://127.0.0.1:5173 (`npm run web:dev`).

**Decisions closed this session:**
| # | Date | Decision |
|---|------|----------|
| D-039 | 2026-08-10 | **Chat threads (and paragraph comments) live in the app DB**; local-folder export/import is optional backup, not the source of truth. |

**Product agreements (recorded, not yet built):** see Pending — UI build order.

---

**Session 2026-08-11 — Sweep hosting + secrets**

**Product decision:**
- Removed from Pending the “enable Anthropic auto-reload” task (owner will not do it).

**Hosting (UI order item 6 + immediate secrets):**
- Postgres on **Neon**; schema `0001_initial_schema.sql` applied.
- Web service on **Render Free**: `https://board-of-advisors-sweep.onrender.com`
- Code: `GET /health` (and `GET /`) + `npm start` script (commit `6b91bbe` on `main`).
- Secrets aligned: local `.env`, Render env (`DATABASE_URL`, `SWEEP_SHARED_SECRET`, `OWNER_NOTIFY_EMAIL`), GitHub Secrets (`SWEEP_URL`, `SWEEP_SHARED_SECRET`).
- Manual `commitment-sweep` Actions run: **green**.

---

**Session 2026-08-11 — Golden path wired (no Anthropic) + evidence panel**

**Agreement this session:**
- Continue Pending item 1 **without** adding a Claude API key yet.
- Use real Postgres data; keep the LLM on mock until the owner connects Anthropic.

**Backend / API:**
- `MockLlmProvider` + `LLM_PROVIDER=mock` (or empty Anthropic key → automatic mock).
- Golden-path HTTP routes: session, demo document, figure confirm/correct, first reading (NDJSON stream), create/list/transition commitments.
- Owner + profile + conversation bootstrap; commitment persistence (`src/commitments/service.ts`).
- Balanced demo figure seed with no Claude call (`POST /api/documents/demo`).

**UI wired (`web/`):**
- Figure confirmation, First reading, and Commitments no longer fixture-only: they call the API (Vite proxy → `:8787`).
- Session/document mismatch fix (Strict Mode): single-flight session; `documentId` bound to `ownerId`.
- First reading: reopenable right panel (**Figure / Table / Chart**) beside the prose, using confirmed line items and a composition chart.

**Verification:** clean typecheck; 64 tests green; golden-path smoke against Neon OK.

---

**Session 2026-08-11 — Real PDF upload + Claude**

**Agreement:** Pending item 1. `ANTHROPIC_API_KEY` in local `.env`; `LLM_PROVIDER=anthropic`.

**Backend:**
- `POST /api/documents/upload` — raw PDF body + `X-Filename` / `X-Owner-Id` → `ingestFinancialPdf` (native Claude; mock if no key).
- `GET /api/llm/status` — UI can tell mock vs Anthropic.
- 20 MB cap; reject non-PDF; 422 if not a financial statement / empty extraction.

**UI (Confirm figures):**
- Empty state with upload (click or drop). No longer auto-seeds demo on entry.
- Extract → confirm / correct / reject as before. Demo remains a shortcut (“usar demo”).

**Verification:** 69 tests green; typecheck + web build clean; Anthropic Haiku 4.5 ping OK. Owner uploaded a real PDF at `http://localhost:5173/cifras` and confirmed it worked.

---

**Session 2026-08-11 — Chat threads in DB (D-039)**

**Pending item 1.** Source of truth: existing `conversations` / `messages` tables (no migration).

**Backend (new; `askAdvisor` and session bootstrap unchanged):**
- `src/conversations/service.ts` — list / create / rename / delete / export / import.
- Cannot delete the last thread.
- `POST /api/conversations/:id/messages` calls existing `askAdvisor`.
- Optional JSON export (backup); import creates a new thread.

**UI:** rail lists real threads; `/chat/:id` reads/writes the API.

**Unchanged:** schema `0001`, first reading, figure confirmation, commitments, `ensureSession` (still ensures at least one thread).

---

**Session 2026-08-12 — Paragraph comments**

**Pending item 2.** Thread anchored to a first-reading paragraph; owner can keep asking.

**How (no migration, no `askAdvisor` change):**
- Anchor = `system` message with `__boa_anchor_v1__` + JSON (section, excerpt, parent).
- `POST /api/conversations/paragraph` — find-or-create by `(owner, parent, sectionKey)`.
- On send, API builds prompt with excerpt + history; DB stores only the short question.
- UI: selecting a paragraph on `/lectura` opens the inline composer; replies stay in-thread; rail nests `Sobre: …` under the parent.

---

**Session 2026-08-12 — Document view 1b (chat attachment)**

**Pending item 3.** Attaching PDF/JPG/PNG in chat switches to **1b**: document left, advisor right (1a = chat/data only).

**How (no schema change, no financial extraction path):**
- `POST /api/conversations/:id/attachments` stores bytes in `documents` (`kind=other`) + system message `__boa_attachment_v1__`.
- `GET /api/documents/:id/file?ownerId=` serves the original for iframe/img.
- Chat `+` button enables attach; opens `DocumentPane`; can close/reopen.

---

**Session 2026-08-12 — Landed on `main`**

- Merged to `main`: golden-path UI (PR #2), paragraph comments (PR #3), document view 1b (PR #4).
- Item 4 (Create advisor / section) was scoped this session but **not built**.

---

### ⏳ Pending

**UI build — agreed order (2026-08-10):**
1. **Create advisor / Create section + drag to nest**, including:
   - Active Create new advisor / Create new section controls.
   - ⋮ menu on each advisor and section: **Rename**, **Archive**, **Delete**, **Create Sub** (new section/chat inside the advisor or section).
   - Drag to move and nest all advisors and sections.

**Deferred to v2:**
- Nightly digest (Batch API)
- WhatsApp export ingestion (.txt manual)
- Multi-agent chat
- Multi-language UI
- API-key encryption at rest
- Headroom (context compression)

---

**Last Updated:** 2026-08-12 (session close: items 2–3 on main; item 4 pending)
