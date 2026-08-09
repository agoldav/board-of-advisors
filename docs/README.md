# Documentation - Source of Truth

This `/docs` directory is the **permanent source of truth** for the Board of Advisors project.

Every important conclusion, decision, and specification from gstack sessions, design reviews, and team discussions must be captured here. The chat conversation is a working space; these documents are the persistent record.

## Document Structure

### Phase 1: Discovery & Strategy
- **[01-VISION.md](01-VISION.md)** — Mission, value prop, strategic goals, success metrics
- **[02-USERS-AND-PROBLEMS.md](02-USERS-AND-PROBLEMS.md)** — User personas, problems, market context

### Phase 2: Requirements & Planning
- **[03-PRODUCT-REQUIREMENTS.md](03-PRODUCT-REQUIREMENTS.md)** — Functional requirements, features, constraints
- **[04-USER-FLOWS.md](04-USER-FLOWS.md)** — User journeys, interaction patterns, state transitions
- **[05-MVP-SCOPE.md](05-MVP-SCOPE.md)** — MVP features, out-of-scope items, success criteria

### Phase 3: Technical Architecture
- **[06-SYSTEM-ARCHITECTURE.md](06-SYSTEM-ARCHITECTURE.md)** — Architecture overview, tech stack, components
- **[07-DATA-MODEL.md](07-DATA-MODEL.md)** — Entities, relationships, data constraints
- **[08-APIS-AND-INTEGRATIONS.md](08-APIS-AND-INTEGRATIONS.md)** — API endpoints, third-party integrations

### Phase 4: Infrastructure & Operations
- **[09-AUTHENTICATION-AND-SECURITY.md](09-AUTHENTICATION-AND-SECURITY.md)** — Auth strategy, security best practices, compliance
- **[10-PAYMENTS-ARCHITECTURE.md](10-PAYMENTS-ARCHITECTURE.md)** — Business model, payment processing, billing
- **[12-INFRASTRUCTURE.md](12-INFRASTRUCTURE.md)** — Hosting, compute, storage, monitoring
- **[13-DEPLOYMENT.md](13-DEPLOYMENT.md)** — CI/CD pipeline, release process, rollback strategy

### Phase 5: Design & Implementation
- **[11-UI-UX.md](11-UI-UX.md)** — Design system, screens, accessibility, responsive design
- **[14-TESTING.md](14-TESTING.md)** — Testing strategy, test types, coverage goals
- **[15-IMPLEMENTATION-PLAN.md](15-IMPLEMENTATION-PLAN.md)** — Project phases, timeline, team structure

### Phase 6: Decisions & Status
- **[16-DECISIONS.md](16-DECISIONS.md)** — Architecture & product decisions (decision log)
- **[17-OPEN-QUESTIONS.md](17-OPEN-QUESTIONS.md)** — Unanswered questions, pending decisions
- **[18-PROJECT-STATUS.md](18-PROJECT-STATUS.md)** — Current status, metrics, risks, progress

## How to Use

### During gstack Sessions
1. Run the skill (e.g., `/office-hours`, `/plan-eng-review`)
2. Capture conclusions and decisions in the relevant docs
3. Update **[16-DECISIONS.md](16-DECISIONS.md)** if a significant choice was made
4. Mark resolved questions in **[17-OPEN-QUESTIONS.md](17-OPEN-QUESTIONS.md)**
5. Update **[18-PROJECT-STATUS.md](18-PROJECT-STATUS.md)** with progress

### For Project Stakeholders
- **Product Managers:** Read 01-VISION through 05-MVP-SCOPE
- **Engineers:** Read 06-SYSTEM-ARCHITECTURE through 14-TESTING
- **Designers:** Read 04-USER-FLOWS and 11-UI-UX
- **Operations:** Read 09-AUTHENTICATION-AND-SECURITY, 12-INFRASTRUCTURE, and 13-DEPLOYMENT
- **Leadership:** Read 01-VISION, 18-PROJECT-STATUS, and 16-DECISIONS

### Maintaining Docs
- **Update frequency:** After every major gstack session
- **Ownership:** Owner field in each document header
- **Review cycle:** Monthly review of all docs (see 18-PROJECT-STATUS for review dates)
- **Staleness detection:** Docs older than 6 weeks without updates get flagged for review

## What NOT to Put Here

❌ Chat transcript excerpts (link to decisions instead)
❌ Brainstorming notes (synthesize into structured decisions)
❌ Temporary ideas or "maybe later" thoughts (capture in 17-OPEN-QUESTIONS.md instead)
❌ Sensitive data (credentials, API keys, personal info)
❌ In-progress work (use git branches/PRs for that)

## What SHOULD Be Here

✅ Final decisions (link to 16-DECISIONS.md)
✅ Specifications (architecture, APIs, data models)
✅ Requirements and acceptance criteria
✅ Design system and UI specifications
✅ Operational runbooks and deployment procedures
✅ Decisions that affect future work
✅ Current project status and blockers

## Directory Structure

```
docs/
├── README.md                          (this file)
├── 01-VISION.md
├── 02-USERS-AND-PROBLEMS.md
├── 03-PRODUCT-REQUIREMENTS.md
├── 04-USER-FLOWS.md
├── 05-MVP-SCOPE.md
├── 06-SYSTEM-ARCHITECTURE.md
├── 07-DATA-MODEL.md
├── 08-APIS-AND-INTEGRATIONS.md
├── 09-AUTHENTICATION-AND-SECURITY.md
├── 10-PAYMENTS-ARCHITECTURE.md
├── 11-UI-UX.md
├── 12-INFRASTRUCTURE.md
├── 13-DEPLOYMENT.md
├── 14-TESTING.md
├── 15-IMPLEMENTATION-PLAN.md
├── 16-DECISIONS.md                    (decision log)
├── 17-OPEN-QUESTIONS.md               (pending decisions)
├── 18-PROJECT-STATUS.md               (current status)
└── diagrams/                           (architecture diagrams, ERDs, flowcharts)
```

## Quick Reference: Which Doc?

| Question | Document |
|----------|----------|
| What are we building? | 01-VISION.md |
| Who uses it and why? | 02-USERS-AND-PROBLEMS.md |
| What features does it have? | 03-PRODUCT-REQUIREMENTS.md |
| How do users interact with it? | 04-USER-FLOWS.md |
| What's in the MVP? | 05-MVP-SCOPE.md |
| What's the architecture? | 06-SYSTEM-ARCHITECTURE.md |
| What's the data model? | 07-DATA-MODEL.md |
| What APIs exist? | 08-APIS-AND-INTEGRATIONS.md |
| How do we authenticate? | 09-AUTHENTICATION-AND-SECURITY.md |
| How does billing work? | 10-PAYMENTS-ARCHITECTURE.md |
| What does it look like? | 11-UI-UX.md |
| Where does it run? | 12-INFRASTRUCTURE.md |
| How do we release? | 13-DEPLOYMENT.md |
| How do we test it? | 14-TESTING.md |
| What's the plan? | 15-IMPLEMENTATION-PLAN.md |
| What was decided and why? | 16-DECISIONS.md |
| What's still uncertain? | 17-OPEN-QUESTIONS.md |
| What's the status? | 18-PROJECT-STATUS.md |

## Editing Conventions

### Headers
- Use Markdown headers (# Title, ## Subtitle, etc.)
- Front-load key info (don't bury conclusions)

### Updates
- Always include a "Last Updated" timestamp
- For decisions: include Date, Owner, Status
- For open questions: include Priority, Due Date, Owner

### Links
- Link decisions from other docs: see [D-001 in Decisions](16-DECISIONS.md#d-001)
- Link questions from status: see [Q-P-001 in Open Questions](17-OPEN-QUESTIONS.md#q-p-001)

### Examples
```markdown
### D-001: Chose PostgreSQL for primary DB
**Date:** 2024-01-15
**Owner:** @engineer-name
**Status:** Approved

Rationale: ACID guarantees for financial transactions, mature ecosystem.
Alternatives: MongoDB (flexibility but eventual consistency), MySQL (simpler but ACID weaker).
```

## Getting Started
1. Read this README
2. Skim all 18 documents to understand their scope
3. During the first gstack session, fill in 01-VISION and 02-USERS-AND-PROBLEMS
4. Update docs after each session
5. Keep 18-PROJECT-STATUS.md current weekly

---

**Created:** 2026-08-07
**Owner:** Abraham (user)
**Last Review:** TBD
