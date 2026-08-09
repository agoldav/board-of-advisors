# Claude Code Guidelines for Board of Advisors

## gstack Integration

This project uses [gstack](https://github.com/garrytan/gstack) — an open-source software factory by Garry Tan (YC President & CEO) that structures Claude Code sessions around a sprint methodology: **Think → Plan → Build → Review → Test → Ship → Reflect**.

### Available gstack Skills

**Discovery & Planning (Think → Plan)**
- `/office-hours` — Product interrogation. Six forcing questions that reframe the problem before building.
- `/plan-ceo-review` — Strategic rethinking. Challenges scope and identifies the core insight hiding in the request.
- `/plan-eng-review` — Architecture lock-in. Data flow diagrams, edge cases, test plans, and hidden assumptions.
- `/plan-design-review` — Design audit. Rates design dimensions 0–10, identifies gaps, proposes polish.
- `/plan-devex-review` — Developer experience. Explores personas, benchmarks, friction points, magical moments.
- `/design-consultation` — Design system from scratch. Landscape research, creative risks, mockups.
- `/investigate` — Root-cause debugging via systematic hypothesis testing.

**Design & Validation (Build → Review)**
- `/design-shotgun` — Design exploration. 4–6 mockup variants, comparison board, iterative feedback.
- `/design-html` — Design → production HTML. Shippable, zero dependencies, responsive.
- `/design-review` — Live design audit. Captures screenshots, flags slop, atomic commits for fixes.
- `/qa-only` — QA reporting only. Bug reports without code changes.

**Security & Analysis**
- `/cso` — Chief Security Officer. OWASP Top 10 + STRIDE threat modeling, zero noise.
- `/codex` — Code search and analysis across the repo.

**Release & Deployment (Ship → Reflect)**
- `/review` — Staff engineer code review. Finds bugs, auto-fixes obvious issues, flags gaps.
- `/ship` — Release engineer. Sync, test, audit coverage, push, open PR.
- `/land-and-deploy` — Merge, deploy, verify production health.
- `/canary` — Post-deploy monitoring. Console errors, performance regressions, page failures.
- `/benchmark` — Performance baseline. Core Web Vitals, page load times, resource sizes.
- `/retro` — Weekly engineering retrospective. Reflect on what worked.

**Other Tools**
- `/browse` — For all web browsing (instead of raw Claude browser tools)
- `/learn` — Learn about specific libraries/frameworks
- `/document-generate` — Auto-generate technical documentation

---

## Project Workflow

**Your explicit request:** Focus on **discovery, brainstorming, requirements, architecture, UX planning, security planning, and implementation planning**. Do NOT implement application code unless explicitly asked.

### When you describe a feature or product idea:
1. Run `/office-hours` — reframe the problem with forcing questions
2. Run `/plan-ceo-review` — challenge scope and find the 10-star version
3. Run `/plan-eng-review` — lock architecture, data flow, test strategy
4. If relevant: `/plan-design-review` — design quality and UX audit
5. If relevant: `/cso` — security audit and threat modeling
6. Save the plan. Do NOT run the build skills (`/design-html`, `/ship`, etc.) unless you explicitly ask.

### When you request implementation:
- Explicitly say "implement" or "build" and the scope
- Then use `/design-html` for UI, `/ship` for deployment, etc.
- Only then will implementation code be written

### When you ask for review or QA:
- `/review` — code quality and bug detection
- `/qa-only` — QA reporting (report bugs, don't fix code)
- `/cso` — security audit

---

## Principles

- **Think before building.** `/office-hours` + `/plan-ceo-review` reframe almost every request. This saves days of rework.
- **Plan feeds the build.** Each skill writes docs that the next skill reads. Nothing falls through the cracks.
- **No implementation without asking.** The default is planning-only. Implementation requires an explicit request.
- **Production-ready or nothing.** When you do build, `/review` and `/qa` ensure it ships without surprises.
- **Design is not decoration.** `/plan-design-review` rates design intent 0–10. Polish matters.
- **Security is foundational.** `/cso` runs OWASP + STRIDE. Every feature gets audited.

---

## gstack Skills Reference

For full documentation on all skills, see:
- `~/.claude/skills/gstack/README.md` — Complete overview
- `~/.claude/skills/gstack/AGENTS.md` — Agent dispatch guidance
- `~/.claude/skills/gstack/ARCHITECTURE.md` — Design philosophy

---

## Key Reminders

- Use `/browse` for web browsing, not raw Claude browser tools
- Every plan is a checkpoint — review it before moving to the next phase
- Retros happen weekly — run `/retro` to capture lessons
- Performance matters — use `/benchmark` to baseline and compare
- Security is non-negotiable — `/cso` before any production push

---

**gstack version:** Latest (auto-updates hourly)
**Last configured:** 2026-08-07
