# Board of Advisors — Web UI

React + Vite implementation of the screens in `../UI Design/`.

## Run

Terminal 1 — API (Postgres + mock LLM, no Anthropic key required):

```bash
npm run dev:api
```

Terminal 2 — UI:

```bash
npm run web:dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` → `:8787`.

## Routes

| Path | Screen |
|------|--------|
| `/cifras` | A — Confirmación de cifras (demo seed → confirm) |
| `/lectura` | B — Primera lectura (mock stream → accept commitment) |
| `/chat` | C — Chat con asesor (still fixtures) |
| `/compromisos` | D — Compromisos (from Postgres) |

## Notes

- Pixel direction follows **1a** (persistent left rail). Direction **1b** (document beside advisor) activates when attaching PDF/JPG/PNG in chat.
- Golden path (cifras → lectura → compromisos) is wired to the API with **MockLlmProvider** until an Anthropic key is set.
- Theme toggle (claro/oscuro) sits in the rail footer.
- Labels that mix English/Spanish in the rail are intentional (per design handoff).
