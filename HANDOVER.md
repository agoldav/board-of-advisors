# Handover to Cursor — Board of Advisors

**Status:** Ready for implementation  
**Date:** 2026-08-08  
**From:** Claude Code (planificación/arquitectura)  
**To:** Cursor (construcción)

---

## What's Done

✅ **Discovery & Planning** — Completed via gstack sessions  
✅ **Architecture locked** — D-001 to D-038 (decisions finalized)  
✅ **Data model specified** — docs/07-DATA-MODEL.md  
✅ **System architecture** — docs/06-SYSTEM-ARCHITECTURE.md  
✅ **Business context** — BUSINESS_CONTEXT.md (Siscon company profile)  

## Build Order (from PROJECT_CONTEXT_ESP.md § Pendiente)

### 1. **Database Schema**
- Tables only, no logic
- See: docs/07-DATA-MODEL.md (Entity diagram, schema details)

### 2. **In Parallel**
- **Business Profile** — Cached context (versioned immutable prefix, 4096+ tokens)
- **Model Abstraction Layer** — Routes queries: Haiku (routine) → Sonnet (advisory) → Opus (hard reasoning)
- **Commitment Subsystem** — State machine (pending/done/overdue/postponed/discarded)

### 3. **Advisor Engine**
- Waits for model abstraction to be ready
- Delivers first reading (cash reconciliation) on onboarding

## Key References

- **Complete plan:** [PROJECT_CONTEXT_ESP.md](PROJECT_CONTEXT_ESP.md) — Read § 9 Pendiente for what's left
- **Architecture & decisions:** [docs/06-SYSTEM-ARCHITECTURE.md](docs/06-SYSTEM-ARCHITECTURE.md)
- **Data model:** [docs/07-DATA-MODEL.md](docs/07-DATA-MODEL.md)
- **Business context:** [BUSINESS_CONTEXT.md](BUSINESS_CONTEXT.md)

## Critical Constraints

- **Prompt caching is architecture, not optimization** (D-008). Prefixes must be byte-stable.
- **No budget cutoff in UI, only alerts** (D-032). Track usage, warn at 90%, but don't block.
- **First reading must be meaningful** (D-021). Run cash reconciliation on first upload, not a mirror summary.
- **Streaming on first read** (D-038). Show output while generating; don't spin for minutes.

## Reminders

- All decisions are in PROJECT_CONTEXT_ESP.md
- Any changes to "Completado" require discussion first
- GitHub repo: https://github.com/agoldav/board-of-advisors

---

Ready to build. 🚀
