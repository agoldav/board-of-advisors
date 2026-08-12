# Handoff: Board of Advisors — pantallas A, B, C, D

## Overview

Board of Advisors is an AI board-of-advisors product for small-business owners. The owner uploads financial
statements, confirms the figures extracted from them, receives a first reading from a specialist advisor,
can talk to that advisor one-to-one, and tracks what he agreed to do.

Hard product rule: **no advice without confirmed figures.** The figure-confirmation screen is a gate, not a form.

Four screens are designed, each in **light and dark**:

| Screen | File | What it is |
|---|---|---|
| **A** — Confirmación de cifras | `A - Confirmacion de cifras.html` | Review and confirm extracted figures. Two competing directions, **1a** and **1b** — one still to be picked. |
| **B** — Primera lectura | `B - Primera lectura.html` | The advisor's diagnosis, ending in a dated recommendation. |
| **C** — Chat con asesor | `C - Chat con asesor.html` | One-to-one thread with a single specialist. |
| **D** — Compromisos | `D - Compromisos.html` | What the owner committed to, grouped by urgency. |

B, C and D are built on **direction 1a** (persistent left rail), which the client selected. Screen A still
carries both 1a and 1b so the alternative can be compared; **1b is a candidate, not a screen to build.**

UI language is **Spanish (Costa Rica)**. All copy is final-intent, not lorem. Do not translate or rewrite it.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and
structure, not production code to copy. Recreate these designs in the target codebase's existing
environment (React, Vue, etc.) using its established patterns, component library and styling approach.
If no environment exists yet, choose the framework appropriate to the project.

The `standalone/` HTML files are self-contained: open them in any browser to see the designs exactly as
intended, fonts embedded. **Start there.** Do not read them as source — they are compiled.
The `.dc.html` files are the authored sources; their markup is readable and is the accurate reference for
structure, spacing and exact color values. They use a component runtime that will not run standalone.

## Fidelity

**High fidelity.** Final colors, typography, spacing and copy. Recreate pixel-accurately.
Frames are designed at **1440 wide**. Frame heights vary (900–1290px) only because the mockups show
expanded states with no scroll; **in the real app the viewport is fixed and the content region scrolls.**
Mobile is out of scope for this round — the product is desktop-first.

## Visual direction

A hybrid, per client direction: **structure, density and radius scale from the Mintlify system**
(`DESIGN_STANDARDS.md`), **typography and atmosphere from the product brief**. The brief explicitly forbids
Inter/Roboto/Arial, purple-on-white themes, cream+serif+terracotta, floating badges, glow, multi-layer
shadows, emoji and decorative cards. The product should read as a *despacho / boardroom*, not an AI toy.

- Brand and headlines: **Instrument Serif** (regular)
- UI text: **Instrument Sans** (400/500/600)
- All figures: **JetBrains Mono** with `font-variant-numeric: tabular-nums`
- Atmosphere: light = cool green-grey linear wash; dark = deep ink with a radial teal halo
- Accent (deep mint) is reserved for confirmation, active state, advisor identity and progress — never body text or large fills

## Shared shell

Every screen is the same three-part shell: **left rail (260px, fixed) · main column · chat bar (bottom)**.
The rail and the chat bar are identical across all four screens — build them once.

### Left rail — 260px, `border-right` hairline, translucent background, padding `26px 18px 22px`

Top to bottom:

1. **Brand lockup** — an `11 × 11px` solid accent square + "Board of Advisors" in Instrument Serif 19px, `letter-spacing -0.2px`. Padding `0 8px 24px`.
2. **CREATE NEW ADVISOR** — a `14 × 14px` square outline containing "+", then mono 10px uppercase `letter-spacing .14em`. Padding `0 8px 10px`, `gap 8px`.
3. **Advisors panel** — surface card, 1px hairline, `border-radius 8px`, padding `12px 12px 8px`.
   - Header row: "Financial Advisor" 14px/600 + accent mono 11px count "3".
   - **Thread tree**, indented with real borders (not absolute positioning): a container with
     `margin-left:5px; border-left:1px solid <line>`, each row a flex line beginning with a
     `13px × 1px` elbow rule and `margin-right:8px`. Level 2 nests the same construction with
     `margin-left:21px`. Rows: "Where is the money" (12px/500) → "Request 1 - 02/12/2026" (level 2)
     → "Plan savings for project A" and "Create a cashflow projection" (12px *italic* — these are
     suggested/unstarted threads).
     Active thread = a `border-radius 4px` tinted fill on the row, label goes 600.
   - Below the tree, the other advisors as plain 14px rows, padding `6px 2px`: Marketing Advisor,
     Sales Advisor, Operations Advisor.
4. **CREATE NEW SECTION** — same treatment as CREATE NEW ADVISOR, sitting **below** the panel with
   `padding-top:30px` (the larger gap is deliberate — it separates advisors from sections).
5. **Section list**, `gap 2px`, rows `9px 10px`, `border-radius 6px`:
   Perfil Empresarial · Sales Advisor · Operations Advisor · Compromisos · Documentos.
   Trailing indicators are all **18px wide** so they share a vertical axis:
   - Sales Advisor: an `18 × 18px` `#ff005f` filled circle with a white mono 10px/600 "2" — unread messages.
     This magenta is the only color outside the palette in the entire UI; it exists solely as the unread signal.
   - Operations Advisor "3" and Documentos "50": mono 11px muted, centered in an 18px box.
   - Compromisos: mono 11px in the error color, "1 vencido".
   - Active section = filled ink pill (light) / `#182421` (dark), label 500 in the inverse color.
6. **Spacer** (`flex:1`), then a **footer** above a `border-top` hairline, padding `16px 10px 0`:
   "Siscon S.R.L." 13px/500 and "Abraham · Goldgewicht - Gerente" 12px muted.

### Chat bar — bottom of every screen

Padding `12px 40px 14px`, `border-top` hairline, translucent background. Inside: a `44px` tall
`border-radius 9999px` pill, 1px hairline, padding `0 6px 0 12px`, `gap 12px` — a `24px` circular
"+" attach button, the placeholder "Pregúntale al Asesor Financiero…" 14px muted (flex 1), and a solid
"Enviar" pill `8px 20px`.

Screen C replaces this with its own taller composer (see below); it does not get both.

## Screens

### A — Confirmación de cifras

Two directions. **1a is the selected one.**

#### 1a — "Libro de revisión"

Main column, three regions:

1. **Header**, padding `34px 40px 22px`, `border-bottom` hairline. Left: "Confirma lo que leí de tus estados"
   — Instrument Serif 34px/1.1; subtitle 14px/1.5, `max-width 520px`. Right, bottom-aligned: mono 12px
   `estados_2026_jun.pdf`, mono 11px muted "7 páginas · extraído hoy 09:14".
2. **Content**, padding `20px 40px 0`, `gap 18px`.
   - **Validation banner** — `13px 18px`, `border-radius 8px`, 8px dot + 14px/500 label + mono 13px equation.
   - **Two-column grid** `1fr 1fr`, `gap 28px`.
     - **Left card — Balance general.** Surface, hairline, `border-radius 8px`, **`overflow-y: auto`** —
       this card scrolls independently; that is what absorbs the expanded row below.
       Header `14px 20px`: title 15px/600 + mono 11px "al 30 jun 2026 · USD".
       Column head `8px 20px`, mono 10px uppercase: Cuenta / Pág. / Monto / Conf.
       **Row grid, used by the head and every data row: `1fr 62px 132px 62px`, `gap 14px`.**
       Section labels ("Activos", "Pasivos", "Patrimonio") mono 10px uppercase, padding `6–8px 20px 4px`.
       Data rows `7px 20px`, faint bottom border: account 14px · page mono 11px muted ·
       amount mono 14px right tabular · confidence mono 11px muted right.
       Subtotals ("Total activos", "Pasivo + patrimonio"): grid `1fr 132px`, `10px 20px`, tinted, label 13px/600, amount mono 14px/600.
       - **Expanded row — "Cuentas por cobrar".** Shown in the open state. The parent row is tinted, its
         label goes 500, prefixed by a `9px` accent "▼" and followed by mono 10px muted "3 facturas".
         Three child rows follow: same grid, padding `6px 20px 6px 41px` (the left indent aligns children
         under the parent label), a faintly darker background, name 13px over mono 10px muted
         "`fact. 0412 · 47 días`", amount mono 13px right. The three children sum to the parent's 10,000:
         Constructora Vega 4,200 (47 días) · Grupo Solera 3,300 (38) · Municipalidad de Alajuela 2,500 (31).
         Collapsed is the default state; the caret rotates and the children mount.
     - **Right column**, `gap 18px`.
       - **Estado de resultados** card — header + five rows on the same grid, then the **composition bar**:
         padding `14px 20px 13px`, `gap 9px`; mono 10px uppercase "Composición de cada dólar facturado"
         + mono 11px "base 214,800"; a `9px` tall pill track with four segments — `61.2%` costo,
         `13.5%` gastos, `2.1%` otros, `23.2%` utilidad (accent); legend `gap 16px`, each = 7px dot +
         12px label + mono 12px percentage. Then subtotal "Utilidad neta" `12px 20px`, amount mono 16px/600.
       - **Note card** — mono 10px uppercase eyebrow "Lo que el board mirará primero" + 14px/1.55 prose
         with the two key figures set in mono inline. `text-wrap: pretty`.
3. **Action bar**, `18px 40px`, `border-top` hairline. Left: 13px muted "18 renglones extraídos · ninguno editado".
   Right `gap 10px`: "Rechazar extracción" (ghost) · "Corregir" (outlined pill) · "Confirmar cifras" (solid pill `11px 24px`).

Then the shared chat bar.

#### 1b — "Cotejo contra el PDF" *(alternative — do not build unless chosen)*

No rail. Top bar with the brand lockup and "Paso 1 de 2" + a `120 × 3px` progress track 50% filled.
Body splits into a `600px` source pane — file header, a `56px` thumbnail strip (four `72px` cells, active
one with a 2px accent border), and a striped `repeating-linear-gradient` **placeholder standing in for the
real rendered PDF page**, carrying an absolutely positioned highlight band (`top:186px`, `height:34px`,
accent at 12% with accent hairlines) — and a reading pane with a 32px serif title, compact validation banner,
underline tabs (Balance general · Estado de resultados · Notas), and rows on a `1fr 150px 96px` grid where
column 1 stacks the account name 15px over mono 11px "`p.2 · confianza 99%`" and column 3 is "Editar" in accent.

### B — Primera lectura

The advisor's diagnosis. Rail state: "Request 1 - 02/12/2026" active.

- **Header**, `30px 44px 20px`: mono 10px uppercase eyebrow "Asesor Financiero · primera lectura";
  title "La utilidad creció. La caja no." Instrument Serif 34px/1.1. Right: accent dot + mono 11px
  "sobre cifras confirmadas · 30 jun 2026" — the visible proof of the no-advice-without-figures rule.
- **Body**, `22px 44px 0`. Every block is a **`1fr 250px` grid with `gap 44px`**: prose left, figure right.
  The right column is a `border-left` hairline with `padding-left:18px` holding a mono 24–26px tabular
  figure, a mono 10px uppercase caption, and optionally a 13px derived ratio.
  - Lede (no heading): the 50,000 vs 3,000 distance. Margin figure **47,000 — "Utilidad que no está en caja"**.
  - **Cobros** — 10,000 receivable · "≈ 8 días de venta".
  - **Inventario** — 18,400 · "30% de los activos".
  - **Exposición** — 16,800 · "5.6× la caja disponible".
  Each block `padding:16px 0` with a faint `border-top`.
  - **"Lo que necesito saber"** — mono 10px eyebrow, then the advisor's question in Instrument Serif 21px/1.35,
    then a 14px line explaining why the answer changes the advice. Stronger `border-top`. Right column empty.
- **Recommendation bar** — pinned above the chat bar, surface background, `18px 44px`, `border-top` hairline,
  entering with `riseIn`. Left: mono 10px eyebrow "Recomendación", the action 17px/500, and the due date in
  accent mono 12px. Right: "Ahora no" (ghost) · "Cambiar la fecha" (outlined) · "Aceptar como compromiso" (solid).
  **This bar is the bridge to screen D** — accepting creates the commitment.

#### Inline comment on a paragraph

Any paragraph in the reading can be clicked to comment on it. In the mock this is shown open on the
**Cobros** paragraph:

- The paragraph itself gains a selected treatment: accent tint at 8% (light) / 10% (dark),
  `border-radius 4px`, `padding:5px 9px` with a matching negative margin so the text does not shift.
- Directly below, `margin-top:14px`, a composer **the same width as the prose column and `124px` tall**
  (about twice the paragraph's height): surface background, **accent 1px border**, `border-radius 10px`,
  soft shadow, entering with `riseIn .35s`.
  - Header `7px 16px`, hairline bottom: mono 10px uppercase "Sobre este párrafo · Cobros" + a `×` dismiss.
  - Field `10px 16px`: placeholder 15px muted "Pregunta o comenta sobre estos 10,000 por cobrar…" followed
    by a `1.5 × 22px` caret block.
  - Footer `6px 12px 6px 16px`, hairline top, tinted: a `24px` circular "+" attach button + mono 11px
    "El Asesor Financiero responde en el hilo"; right, "Cancelar" (ghost) + "Enviar" (solid pill).
- **Opening the composer pushes the following blocks down** — it is in flow, not an overlay. In the app the
  body region scrolls; the mock simply grew the frame.

### C — Chat con asesor

One specialist at a time. Rail state: "Where is the money" active in the tree.

- **Header**, `22px 44px 18px`: a `9px` accent square + "Asesor Financiero" Instrument Serif 26px +
  "Cambiar de asesor" 13px muted; below, indented `19px` to align under the name, mono 11px
  "Where is the money · responde sobre las cifras confirmadas de junio". Right: mono 11px "hoy · 7 jul 2026".
- **Thread**, `24px 44px 0`, `gap 20px`, every message `max-width 860px`.
  - **Owner messages**: plain, no container. Name 13px/600 + mono 11px timestamp, then 15px/1.6 prose.
  - **Advisor messages**: surface card, hairline, `border-radius 8px`, `14px 16px`. Header is a `6px` accent
    square + name 13px/600 + mono 11px timestamp. **No bubbles, no avatars, no tails** — the surface and the
    accent mark carry the distinction.
  - **Recommendation footer inside the final advisor message**: `margin:5px -16px 0` so it spans the card's
    full width, `padding:12px 16px`, `border-top` hairline, tinted, `border-radius 0 0 7px 7px`.
    Holds the mono eyebrow "Recomendación", the action 15px/500, the accent mono due date, and a solid
    "Convertir en compromiso" pill. Same gesture as B's recommendation bar, so it is learned once.
- **Composer**, `16px 44px 20px`: `112px` tall, `max-width 860px`, surface, hairline, `border-radius 10px`.
  Field `12px 16px` with placeholder + caret; footer `8px 12px 8px 16px` with the "+" attach button,
  mono 11px "Habla con un asesor a la vez", and a solid "Enviar".

### D — Compromisos

Grouped by urgency, not by date. Rail state: Compromisos active.

- **Header**, `30px 44px 20px`: "Lo que dijiste que ibas a hacer" serif 34px; subtitle
  "Seis compromisos desde que empezamos. Uno se venció el viernes." Right: mono 11px "hoy · 7 jul 2026".
- **Group headers** — mono 10px uppercase label + a `1px` rule filling the remaining width (`flex:1`).
  The Vencido rule uses the error border color; the others the neutral hairline.
- **Vencido** — one card, error border, error-tinted background, `border-radius 8px`, entering with `riseIn`.
  Isolated from the list so it reads as urgent without shouting.
- **Pendientes** — plain rows, `14px`, faint bottom border. Each row: action 16px, then a meta line —
  mono 12px due date, a `1 × 11px` divider, and 12px muted **provenance** ("de la primera lectura · 30 jun",
  "del chat con el Asesor Financiero · 1 jul"). Every commitment says where it came from.
  Right: "Descartar" · "Posponer" · "Marcar hecho".
- **Cerrados** — a `110px 1fr` grid, `gap 20px`, baseline-aligned. Left: mono 11px uppercase status in
  accent (Hecho) / muted (Pospuesto) / faint (Descartado). Right: the action 15px over a 13px explanation —
  **each closed state shows what it owes**: evidence for done ("Cuenta abierta el 2 jul; 2,300 transferidos
  el mismo día"), the new date for postponed, and the **reason** for discarded, which is the highest-signal
  data in the screen. Discarded actions get `line-through` in a faint decoration color.
- **Footer line**: 13px muted "Cada mañana el board revisa esta lista y te escribe sobre lo que se venció."
  — the daily sweep exists without dragging an inbox into the UI.

#### Expanded overdue commitment

The overdue card is shown **expanded**, all of it inside the red border:

1. The header row (action + meta + buttons) as above.
2. A `1px` divider in a red-tinted line color.
3. **The thread**, `gap 11px`:
   - The owner's comment — name 13px/600 + mono 11px "5 jul 2026 · 16:20", then 14px/1.55 prose reporting
     what the client said.
   - The advisor's reply — its own surface **in a lighter tint of the card's red**, not white
     (`#fefaf9` on `#f4e4e2` light; `rgba(224,122,112,.12)` on `#4a2a26` dark), `border-radius 8px`,
     `12px 14px`. Header = `6px` accent square + name + mono timestamp. The reply ends by proposing a new
     date, which is the natural bridge to "Posponer".
4. **The composer**, `124px` tall, same construction as B's: header "Sobre este compromiso" + `×`,
   placeholder "Responde, o explica por qué todavía no se cumple…", footer with "+" attach, hint,
   "Cancelar" and "Enviar".

## Interactions & Behavior

Scope of this round is static mockups; behavior below is the intended implementation.

- **Confirmar cifras** — validates arithmetic server-side, marks the extraction confirmed, unlocks the
  first reading and routes there. The only path that unlocks advice.
- **Corregir** — puts amount and label cells into an editable state in place (no modal). Every edited row
  is flagged; the action-bar counter reflects the count. Re-validate on each edit rather than only on submit.
- **Rechazar** — discards the extraction and returns to upload. Confirm destructive intent.
- **Expand row (A)** — toggles the child rows in flow; the card scrolls, the frame does not grow.
- **Comment on a paragraph (B)** — click any paragraph to open the inline composer beneath it; following
  blocks shift down. Sending posts to a thread and the advisor replies in place.
- **Aceptar como compromiso / Convertir en compromiso** — creates a commitment with the stated due date and
  a provenance reference back to the reading or the chat message that produced it.
- **Marcar hecho** — asks for the evidence line shown in Cerrados.
- **Posponer** — asks for the new date; the closed row then shows "De X a Y" plus the reason.
- **Descartar** — **requires a reason**; it is displayed permanently under the discarded item.
- **Attach ("+")** — file, photo or screenshot, in every composer and the chat bar.

### Motion

One animation, deliberately: `@keyframes riseIn` — `opacity 0 → 1`, `translateY(6px) → none`.
`.5s ease both` for the validation banner, the recommendation bar and the overdue card;
`.35s` for the inline composer. It fires when a result *arrives*, so it feels delivered rather than pre-printed.
No hover elevation, no glow, no staggered row reveals.

### States

| State | Treatment |
|---|---|
| **Cuadra (default)** | Green-tinted banner, accent dot, mono equation `activos 62,200 = pasivo 26,600 + patrimonio 35,600`. Confirmar enabled. |
| **Descuadre** | Red-tinted banner, error dot, `activos 62,200 ≠ pasivo 26,600 + patrimonio 34,200`, plus the delta in words ("Los totales no cuadran por 1,400"). Show the discrepancy, never hide it. Confirmar disabled; the way forward is Corregir or re-upload. Wired to a single boolean (`estadoDescuadre`) that flips all frames. |
| **Compromiso vencido** | Error border and tint, "vencía vie 3 jul · hace 4 días", isolated above the list, rail badge "1 vencido". |
| **Extrayendo** | **Not designed.** Must show real progress (page count advancing), never a bare spinner — extraction can take minutes. |
| **Sin PDF / sin cifras confirmadas** | **Not designed.** Empty state routes to upload; advisor screens must refuse and point back to screen A. |
| **Error de servicio** | **Not designed.** Plain-language message, no jargon, no error codes. |

## State Management

- `extraction`: `{ id, fileName, pageCount, extractedAt, status: 'extracting' | 'ready' | 'confirmed' | 'rejected' }`
- `lineItems[]`: `{ id, statement, section, label, amount, sourcePage, confidence, edited, children[] }` —
  `children` carries the invoice-level breakdown for expandable rows
- `validation`: `{ ok, delta, message }` — computed server-side, re-run after every edit
- `reading`: `{ id, advisorId, headline, blocks[], question, recommendation: { text, dueDate } }`
- `threads[]`: `{ id, advisorId, title, anchor: {type: 'paragraph'|'commitment'|null, id}, messages[] }` —
  the rail tree, the paragraph comments and the chat are the **same** structure at different anchors
- `commitments[]`: `{ id, text, dueDate, status: 'pending'|'overdue'|'done'|'postponed'|'discarded', origin: {type, id, date}, resolution: { evidence | newDate | reason }, thread }`
- `unread`: per-advisor count, drives the magenta badge
- Derived: `canConfirm = validation.ok`; overdue count for the rail badge; edited count for the action bar

Data comes from the existing extraction and advice endpoints. The UI adds no new capability.

## Design Tokens

### Light

| Token | Value | Use |
|---|---|---|
| bg | `linear-gradient(168deg,#eef2f1 0%,#f8faf9 42%,#f2f5f4 100%)` | frame background (1b: `46%`, ends `#eef2f1`) |
| surface | `#ffffff` | cards, advisors panel, composers |
| surface-tint | `#f6f8f7` | subtotal rows |
| surface-foot | `#fafbfb` | composer footers, recommendation footer |
| row-tint | `#f3f7f6` | expanded parent row |
| row-child | `#f9fbfa` | expanded child rows |
| hairline | `#e3e7e6` | structural dividers |
| hairline-faint | `#f0f3f2` / `#e8ecec` | row dividers |
| hairline-strong | `#cfd6d4` | frame border, outlined buttons, tree rules |
| ink | `#0e1413` | headlines, figures, primary button |
| body | `#26302e` | prose, table accounts |
| slate | `#47514f` | secondary prose, rail items |
| steel | `#6d7876` | tertiary labels |
| muted | `#98a19f` | mono metadata, placeholders |
| accent | `#00806a` | brand mark, advisor mark, links, progress, "Editar" |
| accent-bright | `#00b48a` | status dot, composition bar |
| accent-bg | `#effaf6` / border `#b8e3d5` | ok banner |
| accent-select | `rgba(0,180,138,.08)` | selected paragraph |
| error | `#c0483f` | error dot, overdue meta |
| error-bg | `#fdf2f1` / border `#eec3bf` | error banner |
| overdue-bg | `#fdf5f4` / border `#eec3bf` / divider `#f0dbd8` | overdue card |
| overdue-reply | `#fefaf9` / border `#f4e4e2` | advisor reply inside the overdue card |
| unread | `#ff005f` | unread badge — the only off-palette color |

### Dark

| Token | Value | Use |
|---|---|---|
| bg | `radial-gradient(1100px 700px at 12% -10%,#12211e 0%,#0a0d0d 62%)` | frame (1b: `78% -12%`, stop `60%`) |
| surface | `#101514` | cards, advisors panel, composers |
| surface-tint | `#151b1a` | subtotal rows |
| surface-foot | `#0d1211` | composer footers, recommendation footer |
| row-child | `#121817` | expanded child rows |
| hairline | `#1e2624` | structural dividers |
| hairline-faint | `#171d1c` / `#1a201f` | row dividers |
| hairline-strong | `#2a3432` | outlined buttons, tree rules, totals rule |
| nav-active | `#182421` | active rail item, active thread |
| ink | `#e9eeec` | headlines, figures, primary button fill |
| body | `#cbd4d1` | prose, table accounts |
| secondary | `#b9c3c0` | rail items, secondary prose |
| steel | `#7f8a87` | tertiary labels |
| muted | `#5f6a67` | mono metadata, placeholders |
| accent | `#3ddfb4` | brand mark, advisor mark, dots, progress, "Editar" |
| accent-bg | `rgba(61,223,180,.07)` / border `#1d4a3f` | ok banner |
| accent-select | `rgba(61,223,180,.10)` | selected paragraph |
| error | `#e07a70` | error dot, overdue meta |
| error-bg | `rgba(224,122,112,.08)` / border `#5a2b26` | error banner |
| overdue-bg | `rgba(224,122,112,.07)` / border `#5a2b26` / divider `#3a201d` | overdue card |
| overdue-reply | `rgba(224,122,112,.12)` / border `#4a2a26` | advisor reply inside the overdue card |
| unread | `#ff005f` | unread badge — identical in both themes |

### Typography

| Role | Family | Size / weight | Notes |
|---|---|---|---|
| Frame title | Instrument Serif | 34px, 400 | `line-height 1.1` |
| Advisor name (C) | Instrument Serif | 26px, 400 | |
| Advisor question (B) | Instrument Serif | 21px, 400 | `line-height 1.35` |
| Brand wordmark | Instrument Serif | 19px, 400 | `letter-spacing -0.2px` |
| Recommendation (B) | Instrument Sans | 17px, 500 | |
| Commitment action | Instrument Sans | 16px, 400–500 | 500 when overdue |
| Message / prose | Instrument Sans | 15px, 400 | `line-height 1.6` |
| Card title | Instrument Sans | 15px, 600 | |
| Body / meta prose | Instrument Sans | 14px, 400 | `line-height 1.5–1.55` |
| Rail item | Instrument Sans | 14px, 400 | 500 when active |
| Button label | Instrument Sans | 13–14px, 500 | |
| Message author | Instrument Sans | 13px, 600 | |
| Tree row | Instrument Sans | 12px, 500 | *italic* for suggested threads |
| Micro label | JetBrains Mono | 10px, 400 | uppercase, `letter-spacing .12–.14em` |
| Metadata / timestamp | JetBrains Mono | 11px, 400 | |
| Figure — row | JetBrains Mono | 13–16px, 400 | `tabular-nums`, right-aligned |
| Figure — margin (B) | JetBrains Mono | 24–26px, 400 | `tabular-nums` |
| Figure — total | JetBrains Mono | 14–18px, 600 | `tabular-nums` |

Fonts: Instrument Serif, Instrument Sans, JetBrains Mono — all Google Fonts, weights 400/500/600.
**Every figure in the UI must be mono + `tabular-nums`**, and figures quoted inside prose are set in mono inline.

### Spacing, radius, elevation

- Spacing steps: `2 · 4 · 5 · 6 · 7 · 8 · 9 · 10 · 11 · 12 · 13 · 14 · 16 · 18 · 20 · 22 · 24 · 26 · 28 · 30 · 32 · 34 · 36 · 40 · 44` px
- Radius: `4px` (selected paragraph, active tree row) · `6px` (rail items, frame) · `8px` (cards, banners, panels) ·
  `10px` (composers) · `3px` (PDF page, 1b only) · `9999px` (buttons, dots, badges, chat pill)
- Elevation: frames only — `0 24px 48px -20px rgba(14,20,19,.22)` light / `rgba(0,0,0,.5)` dark.
  The inline composer adds `0 6px 18px -10px`. **No shadows on cards** — cards are flat with a hairline border.

## Sample content

Numbers are invented but internally consistent — **the balance sheet balances**. Keep them as fixtures;
the arithmetic matters, and every derived figure in screens B and C is computed from these.

Balance general, al 30 jun 2026, USD:

| Sección | Cuenta | Monto | Pág. | Conf. |
|---|---|---|---|---|
| Activos | Efectivo en bancos | 3,000 | p.2 | 100% |
| Activos | Cuentas por cobrar | 10,000 | p.2 | 99% |
| Activos | → Constructora Vega · fact. 0412 · 47 días | 4,200 | | |
| Activos | → Grupo Solera · fact. 0418 · 38 días | 3,300 | | |
| Activos | → Municipalidad de Alajuela · fact. 0421 · 31 días | 2,500 | | |
| Activos | Inventario de materiales | 18,400 | p.2 | 97% |
| Activos | Equipo y herramientas | 42,000 | p.3 | 99% |
| Activos | Depreciación acumulada | (11,200) | p.3 | 96% |
| | **Total activos** | **62,200** | | |
| Pasivos | Cuentas por pagar | 9,800 | p.3 | 99% |
| Pasivos | Préstamo bancario | 14,500 | p.3 | 98% |
| Pasivos | Impuestos por pagar | 2,300 | p.3 | 97% |
| Patrimonio | Capital social | 5,000 | p.4 | 100% |
| Patrimonio | Utilidades retenidas | 30,600 | p.4 | 98% |
| | **Pasivo + patrimonio** | **62,200** | | |

Estado de resultados, ene–jun 2026, USD: Ingresos por servicios 214,800 (p.5, 99%) ·
Costo de ventas 131,500 (p.5, 98%) · Gastos operativos 28,900 (p.6, 97%) ·
Depreciación del periodo 3,200 (p.6, 99%) · Gastos financieros 1,200 (p.6, 98%) · **Utilidad neta 50,000**.

Derived figures used in B and C: 47,000 profit not in cash (50,000 − 3,000) · ≈8 days of sales in
receivables (10,000 ÷ 214,800 × 180) · inventory 30% of assets · 16,800 debt+tax = 5.6× cash ·
7,200 cash if Vega pays (3,000 + 4,200).

## Assets

None. No images, icons or illustrations. The brand mark is an `11 × 11px` solid square; the advisor mark a
`6–9px` square; the expand caret a mono "▼"; the attach control a "+" in a circle. The 1b PDF preview is a
CSS `repeating-linear-gradient` placeholder for the real rendered page. Fonts load from Google Fonts
(embedded in the standalone bundles).

## Copy notes

All UI copy is Spanish and final-intent. Do not translate or rewrite. Tone: direct board advice — plain,
numeric, no marketing voice, no exclamation, no emoji. The advisor states a number, says what it means,
and asks for the one fact that would change its answer.

Note that the rail's own labels are mixed Spanish/English ("Financial Advisor", "Create new advisor",
"Perfil Empresarial", "Documentos") because they came from the client's own structure. **Left verbatim
on purpose** — flag it to the client rather than silently normalizing it.

## Files

| File | What it is |
|---|---|
| `standalone/A - Confirmacion de cifras.html` | Screen A, directions 1a and 1b, light + dark. Self-contained. |
| `standalone/B - Primera lectura.html` | Screen B, light + dark. Self-contained. |
| `standalone/C - Chat con asesor.html` | Screen C, light + dark. Self-contained. |
| `standalone/D - Compromisos.html` | Screen D, light + dark. Self-contained. |
| `source/*.dc.html` | Authored sources. Readable markup, exact values. Read, don't run. |
| `19-CLAUDE-DESIGN-BRIEF.md` | Product brief: the three pillars (memoria, iniciativa, seguimiento), all four screens, tone rules, explicit do-not list. |
| `DESIGN_STANDARDS.md` | Mintlify system analysis. Source of structural, density and radius conventions **only** — its typography and color are not used. |

## Still to design

The extracting, empty, blocked (advisor screens before figures are confirmed) and service-error states.
Screen A's direction (1a vs 1b) is still formally open, though B, C and D assume 1a.
An optional minimal hub was considered and dropped — the rail covers orientation.
