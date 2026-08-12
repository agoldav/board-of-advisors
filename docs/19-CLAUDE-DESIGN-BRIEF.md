# Brief de diseño — Board of Advisors (para Claude Design)

**Propósito de este documento:** contexto suficiente para diseñar la UI del POC.  
**No diseñar:** login, onboarding largo, chat grupal, multi-idioma, ni integraciones WhatsApp/QuickBooks.  
**Usuario del POC:** un solo dueño (Abraham). Sin pantalla de autenticación.

---

## 1. Qué es el producto (en una frase)

Una **junta de asesores de IA** que conoce *este* negocio, da criterio experto anclado en datos reales, y **hace seguimiento** de lo que se comprometió a hacer — no un chatbot genérico.

### Tres pilares (tienen que sentirse en la UI)

| Pilar | Qué significa en pantalla |
|-------|---------------------------|
| **Memoria** | El board ya conoce el negocio; no se vuelve a explicar desde cero. |
| **Iniciativa** | El board habla primero (p. ej. la “primera lectura”). |
| **Seguimiento** | Las recomendaciones se convierten en compromisos con fecha; si vencen, el board insiste. |

**Valor:** criterio experto + dirección cuando el dueño no sabe qué preguntar.  
**Diferencia vs Claude.ai:** memoria + iniciativa + seguimiento.

### Tonos a evitar

- App de “AI chat” genérica (burbujas juguetonas, gradientes púrpura, badges flotantes).
- Dashboard corporativo lleno de KPIs y cards decorativas.
- Aspecto de to-do list o calendario: el seguimiento es de **asesoría**, no de productividad genérica.

### Tono correcto

Consejo serio de junta: claro, directo, con números cuando hay números. Español del dueño. El producto se siente como un **despacho / boardroom**, no como un juguete de IA.

---

## 2. Quién lo usa y en qué contexto

- **Dueño** de una empresa pequeña (1–15 personas). En el POC: contratista de instalación en Costa Rica (Siscon).
- Decide solo, a menudo por instinto; a veces no sabe ni qué preguntar.
- Usa la app en escritorio primero; móvil debe funcionar, pero el diseño hero es **desktop**.
- Flujo crítico del POC: subir estados financieros → confirmar cifras → recibir primera lectura → aceptar un compromiso → verlo en la lista de seguimiento.

---

## 3. Qué ya existe (backend) — la UI solo lo expone

Ya funciona en código (sin pantallas aún):

1. Subida/extracción de PDF de estados financieros (todos los renglones).
2. Validación aritmética y **confirmación obligatoria** antes de cualquier consejo.
3. Chat 1:1 con un asesor (hoy: Asesor Financiero completo; Asesor de Operaciones stub).
4. **Primera lectura** en streaming: conciliación utilidad vs caja (puede tardar minutos).
5. Compromisos con estados y barrido diario por email (fuera de la UI).

La UI **no inventa features nuevas**: diseña cómo se ven y se usan esas capacidades.

---

## 4. Pantallas a diseñar (alcance de este brief)

Navegación mínima sugerida (ajústala si mejora la claridad; no agregues secciones de marketing):

| Pantalla | Trabajo único |
|----------|----------------|
| **A. Confirmación de cifras** | Revisar lo que Claude extrajo del PDF; confirmar, corregir o rechazar. |
| **B. Primera lectura** | Ver el diagnóstico inicial escribiéndose en vivo; terminar en compromiso. |
| **C. Chat con asesor** | Conversación 1:1 con un especialista. |
| **D. Compromisos** | Lista de lo acordado; marcar hecho / posponer / descartar. |

Opcional (solo si cabe sin clutter): **home / hub** muy liviano que enlace a A–D y muestre 1–2 compromisos vencidos o próximos. Si el hub compite con el contenido, elimínalo y entra directo al flujo.

### Fuera de alcance (no diseñar ahora)

- Login / signup / settings de cuenta  
- Onboarding conversacional de 15–20 min  
- Chat multi-asesor en un solo hilo  
- Selector de idioma  
- Resumen nocturno, WhatsApp, reportes con gráficas para empleados  
- Pantallas de gasto LLM / presupuesto (puede ser un indicador discreto después)

---

## 5. Detalle por pantalla

### A — Confirmación de cifras

**Por qué existe:** un balance mal leído produce consejos convincentes y equivocados. **Sin confirmación no hay consejo.**

**Estados a diseñar:**

1. Subiendo PDF / extrayendo (progreso claro; puede tardar).
2. Cifras listas para revisar (lista de renglones: cuenta, monto, periodo).
3. Error aritmético (activos ≠ pasivo+patrimonio, o subtotales que no cuadran) — **mostrar la discrepancia**, no esconderla.
4. Acciones: **Confirmar** · **Corregir** (editar montos/etiquetas) · **Rechazar** (descartar extracción).

**Éxito:** cifras confirmadas → se desbloquea Primera lectura / consejo.  
**Fallo:** rechazo o descuadre → no se ofrece consejo; el camino es corregir o volver a subir.

**UI notes:** tabla o lista densa y legible; números alineados; no “cards” decorativas por cada renglón.

---

### B — Primera lectura (first read)

**Qué es:** el primer entregable del board tras confirmar estados. No es un resumen de “te entendí”. Es un diagnóstico, p. ej. *“la utilidad dice X pero en el banco hay Y — aquí está la diferencia”*.

**Estructura del contenido (el modelo genera algo así):**

1. Tres observaciones ancladas a números reales.  
2. Una pregunta que el board necesita para profundizar.  
3. Una recomendación con fecha → se convierte en el **primer compromiso**.

**Requisito de interacción:** el texto se **escribe en pantalla mientras se genera** (streaming). Puede tardar minutos. Una rueda girando sola se lee como “se colgó”.

Diseñar:

- Estado streaming (texto apareciendo; sensación de trabajo en curso sin spinner vacío).  
- Estado completo.  
- CTA para **aceptar la recomendación como compromiso** (fecha visible).  
- Si el balance no está confirmado o no cuadra: pantalla de bloqueo corta que mande a Confirmación de cifras.

---

### C — Chat con asesor (1:1)

**Modelo mental:** hablar con **un** especialista a la vez, no con “la IA”.

- Selector o encabezado del asesor activo (ej. **Asesor Financiero**).  
- Hilo de mensajes.  
- Input para preguntar.  
- El asesor puede crear recomendaciones que el dueño convierte en compromisos (diseñar el puente chat → compromiso de forma ligera).

Voz del financiero (referencia de tono): directo, numérico; nombra rubro, monto y tendencia; si un número no está confirmado, lo pide en vez de inventarlo.

No diseñar chat grupal (varios asesores respondiendo en el mismo hilo).

---

### D — Compromisos

Lista de compromisos del dueño. Estados:

| Estado | Notas de UI |
|--------|-------------|
| **Pendiente** | Activo, con fecha. |
| **Vencido** | Se calcula por fecha (no es un flag manual). Debe verse distinto y urgente, sin gritar. |
| **Hecho** | Pedir evidencia breve opcional/corta de qué se hizo. |
| **Pospuesto** | Requiere **nueva fecha**. |
| **Descartado** | **Motivo obligatorio** (campo de alta señal: qué consejo se rechazó y por qué). |

Acciones por ítem: marcar hecho · posponer · descartar.  
Mostrar origen cuando sea posible (vino de primera lectura / de chat).

El email de seguimiento diario ya existe fuera de la UI; aquí solo se gestiona el estado.

---

## 6. Flujos mínimos (para mockups)

### Flujo 1 — Primera vez con valor

1. Sube PDF de estados financieros.  
2. Revisa y **confirma** cifras (o corrige).  
3. Lanza **Primera lectura** (streaming).  
4. Acepta la recomendación → aparece en **Compromisos**.

### Flujo 2 — Uso cotidiano

1. Abre chat con Asesor Financiero.  
2. Pregunta (caja, cobros, contratar, etc.).  
3. Si hay recomendación con fecha → compromiso.  
4. En Compromisos: cierra, pospone o descarta (con motivo).

### Flujo 3 — Vencido

1. Un compromiso pasó la fecha → se muestra **Vencido**.  
2. El dueño actúa (hecho / posponer / descartar).  
(El email de insistencia es paralelo; no hace falta diseñar la bandeja de correo.)

---

## 7. Dirección visual (obligatoria)

Objetivo: una composición seria y memorable, no un dashboard genérico.

**Hacer:**

- Una composición clara por vista (un trabajo por pantalla).  
- Tipografía expresiva (evitar Inter / Roboto / Arial / system por defecto).  
- Fondo con atmósfera (gradiente sutil, textura o plano con profundidad) — no blanco plano muerto ni “cream + serif + terracotta” de plantilla.  
- Jerarquía tipográfica fuerte; el nombre **Board of Advisors** debe sentirse como marca, no solo texto de nav.  
- 2–3 movimientos intencionales (p. ej. entrada del streaming, transición a vencido, revelar confirmación) — presencia, no ruido.  
- Densidad cómoda para números y tablas en Confirmación de cifras.

**No hacer:**

- Tema púrpura-on-white / púrpura-a-índigo.  
- Fondo cream (#F4F1EA-ish) + serif display + acento terracotta (cliché AI).  
- Layout “broadsheet” denso tipo periódico.  
- Dark mode por defecto (a menos que lo justifiques muy bien y quede elegante).  
- Cards en el hero; cards solo si son contenedor real de una interacción.  
- Pills, badges flotantes, chips promocionales, glow, sombras multicapa, emojis.  
- Stats strips, icon rows, o bloques de marketing en la primera vista.  
- Hero con imagen inset en card redondeada; si hay visual dominante, que sea plano completo o atmósfera, no collage.

**Idioma de la UI del POC:** español (labels, vacíos, errores, CTAs).

---

## 8. Contenido de ejemplo (para mockups realistas)

Usa números inventados pero creíbles de contratista pequeño:

- Utilidad YTD: ₡50 000 (o USD 50,000 — sé consistente).  
- Banco: ₡3 000.  
- Cuentas por cobrar: ₡10 000.  
- Observación ejemplo: *“La utilidad creció pero la caja no: el hueco está en cobros / inventario / retiros — no en el margen del estado de resultados.”*  
- Compromiso ejemplo: *“Llamar a los 3 clientes con facturas > 30 días antes del viernes.”*  
- Asesor en header: **Asesor Financiero**.

---

## 9. Entregables pedidos a Claude Design

1. **Dirección visual** (paleta, tipo, atmósfera) — 1 propuesta fuerte, no 6 genéricas.  
2. Mockups de alta fidelidad:  
   - Confirmación de cifras (ok + estado con descuadre).  
   - Primera lectura (streaming + completa + CTA a compromiso).  
   - Chat 1:1.  
   - Lista de compromisos (mezcla pendiente / vencido / acciones).  
3. Si aplica: hub mínimo.  
4. Notas breves de estados vacíos y de error (sin PDF; sin cifras confirmadas; créditos/API caídos — mensaje claro, sin tecnicismos).

**Criterio de éxito del diseño:** el dueño entiende en 10 segundos *dónde confirmar números, dónde leer el diagnóstico, dónde preguntar, y dónde está lo que prometió hacer* — sin tutorial.

---

## 10. Referencia rápida del producto

| Ítem | Valor |
|------|--------|
| Nombre | Board of Advisors |
| Etapa | POC privado (dueño + círculo cercano) |
| Asesores en UI ahora | Financiero (real), Operaciones (nombre) |
| Regla dura | No consejo sin cifras confirmadas |
| Streaming | Obligatorio en primera lectura |
| Compromiso descartado | Motivo obligatorio |

---

*Documento para handoff de diseño. Fuente de verdad del producto: `PROJECT_CONTEXT_ESP.md` y `/docs`. No sustituye decisiones de ingeniería ya cerradas.*
