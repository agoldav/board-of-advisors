# CONTEXTO DEL PROYECTO (Español)

> Documento vivo. Toda conclusión a la que lleguemos en las sesiones de gstack se escribe aquí.
> El chat no es la fuente de verdad. Este archivo y `/docs` sí lo son.
> Versión en inglés: `PROJECT_CONTEXT_ENG.md`

**Proyecto:** Board of Advisors
**Inicio:** 2026-08-07
**Dueño:** Abraham
**Estado:** Descubrimiento / brainstorming (todavía no se escribe código)

---

## 1. Idea Original (tal como la planteó el dueño, 2026-08-07)

Una aplicación que usa inteligencia artificial (vía la API de Claude) para armar un
**Board of Advisors de IA** que dé recomendaciones sobre situaciones reales que ocurren
dentro de la empresa del dueño. Los consejos cubren finanzas, mercadeo, operaciones,
administración y más.

La apuesta central: el board solo sirve si tiene **información en vivo** del negocio.
Por eso la app se conecta a sistemas externos:

- **QuickBooks** — pérdidas y ganancias, balance, cómo se está colocando la plata.
  Alimenta al asesor financiero.
- **WhatsApp** — chats específicos que el dueño seleccione. El dueño entrega la lista
  de empleados (nombre, puesto, departamento, función) para que el board sepa *quién*
  escribe y *para qué* cuando llega un mensaje.
- **App de administración de proyectos** — panorama completo de cómo se está operando
  cada proyecto.

### Modelo de interacción
- El board está compuesto por **especialistas individuales**.
- El dueño puede hablar con **un asesor a la vez** (chat 1:1).
- El dueño también puede abrir un **chat grupal** donde cada asesor relevante responde
  desde su propia especialidad.

### Resumen nocturno
Cada noche el board recopila todo lo ingresado durante el día y produce:
- Un resumen de 3 párrafos de lo acontecido
- Problemas detectados
- Soluciones recomendadas
- Sugerencias de qué hay que hacer

### Onboarding / memoria del negocio
Al inicio el dueño describe el negocio: de qué se trata, fortalezas, debilidades,
preocupaciones actuales, ideas de qué hace falta. Esto se vuelve contexto permanente
para todos los asesores.

### Reportes
El board puede escribir un reporte cuando se le pida, pensado para presentárselo a
otros empleados. Los reportes deben soportar gráficas y usar datos reales que el
sistema haya recopilado.

---

## 2. Modelo de Negocio (según lo planteado)

- **Estado final:** webapp comercial, por suscripción (SaaS).
- **Etapa de prueba de concepto:** gratis, pero el usuario debe poner sus **propias API
  keys** para cada servicio externo (Claude, QuickBooks, etc.), de manera que el dueño
  no pague el consumo de otros.

---

## 3. Restricciones de Producto (según lo planteado)

- **La interfaz debe ser multi-idioma.** El dueño da instrucciones en español; la app
  debe permitirle al usuario final escoger su idioma.
- **La documentación de programación se escribe en inglés.**
- **Se creará un repositorio de GitHub** para guardar el proyecto.
- Toda conclusión importante queda registrada en `/docs` y en este archivo.

---

## 4. La Empresa (contexto recogido 2026-08-07)

- **Tamaño:** 4 personas en oficina + una cuadrilla de instalación.
- **Perfil de proyectos:** muchos proyectos a la vez, cada uno pequeño.
- **Estado financiero:** flujo de caja lento y limitado. Mucho dinero comprometido
  dentro de proyectos activos, recuperación lenta. Presupuesto y reservas limitadas.
- **Tensión estratégica:** quiere crecer hacia proyectos más grandes y complejos, pero
  no tiene ni el personal ni el capital para contratar por adelantado.
  - Contratar primero y perder la licitación → quema salarios y entrenamiento en vano.
  - Ganar primero y contratar después → no da tiempo de reclutar y entrenar antes del arranque.

### Decisiones reales que nombró el dueño (casos de uso textuales)

**Caso A — Riesgo de crecimiento / contratación**
"¿Invertimos en personal ahora, tomamos el riesgo de no contratar hasta ganar el
proyecto y luego corremos con el entrenamiento, o del todo no nos aventuramos en este
tipo de proyecto hasta tener más reservas en el banco?"
- Datos necesarios: plata en banco, capital comprometido en proyectos activos, fechas
  esperadas de cobro, pipeline de proyectos futuros que requieren inversión.
- Fuente: QuickBooks cubre casi todo. **Son tres números y un calendario de cobros,
  no el libro mayor completo.**

**Caso B — Riesgo contractual**
Un cliente de confianza ofrece un contrato cargado de cláusulas de multas y legales
sobre seguridad ocupacional, accidentes, mal comportamiento del personal y atrasos.
Normalmente el dueño no lo firmaría. El cliente es conocido y le tiene confianza; cree
que las cláusulas son defensivas contra malos actores, no depredadoras.
Pregunta: ¿vale el riesgo?
- Datos necesarios: **ninguno de ningún sistema conectado.** Esto requiere análisis de
  documento, contexto del negocio y criterio.

---

## 5. Decisiones Tomadas

*(Se agregan conforme avanza la sesión. Formato: fecha, decisión, razón.)*

| # | Fecha | Decisión | Razón |
|---|-------|----------|-------|
| D-001 | 2026-08-07 | Construir por etapas: primero un MVP real, luego crecer hacia la plataforma completa. | El dueño confirmó que la visión completa no es el primer release. |
| D-002 | 2026-08-07 | La prueba de concepto es solo para el dueño y un círculo cercano. No es pública. | Le quita presión de escala, cobros y multi-tenant a la v1. |
| D-003 | 2026-08-07 | NO construir sobre librerías no oficiales de WhatsApp (whatsapp-web.js, Baileys). | Leen chats personales como se quería, pero violan los términos de servicio, arriesgan baneo del número y se rompen cuando Meta cambia algo. No se puede vender un producto encima de eso. |
| D-004 | 2026-08-07 | WhatsApp para el MVP = **Opción 4, exportación manual del chat (.txt) + subida**. | Elección explícita del dueño. Cero costo, cero zona gris legal, funciona hoy. Telegram Bot API (Opción 5) queda como ruta de mejora para v2. |
| D-005 | 2026-08-07 | Techo de presupuesto para el LLM: **$5/mes es cómodo, $30/mes no**. | Lo dijo el dueño directamente. Es lo que fuerza la decisión de enrutamiento de abajo. |
| D-006 | 2026-08-07 | **Enrutar por tipo de tarea, no escoger un solo modelo.** Haiku 4.5 para trabajo rutinario (parsear el export de chat, extraer datos, redactar el resumen nocturno), Sonnet 5 para razonamiento de asesoría, Opus 5 solo para los juicios más duros. | Haiku cuesta 1/5 de Opus. Cerca del 80% de la carga es rutina. Mantiene la factura mensual dentro del techo declarado. |
| D-007 | 2026-08-07 | **No agregar un segundo proveedor de LLM para el POC.** En su lugar, construir una capa delgada de abstracción de modelo para que el proveedor sea un cambio de configuración. | Con un usuario y ~$10/mes, un segundo proveedor es trabajo de ingeniería para ahorrar casi nada. La capa de abstracción es barata ahora y vuelve trivial el cambio después. |
| D-008 | 2026-08-07 | **El prompt caching es requisito de arquitectura, no una optimización.** El prefijo de contexto del negocio tiene que ser estable y cacheable. | Las lecturas de caché cuestan ~10% del precio normal de entrada. El "board que conoce tu negocio" reenvía ese contexto en cada llamada; sin caché es la línea de costo dominante. Confirmado por el dueño. |
| D-009 | 2026-08-07 | **El escalamiento de modelo debe ser automático.** El sistema decide solo si Haiku alcanza o si hay que subir de modelo. | Requisito explícito del dueño. Dos mecanismos: (a) la **herramienta advisor** de Claude — ejecutor barato + asesor capaz consultado a mitad de generación; (b) una llamada barata de clasificación previa en Haiku que enruta por nivel de pregunta. Ver §6d. |
| D-010 | 2026-08-07 | **El resumen nocturno corre por Batch API (50% más barato).** | El resumen no tiene requisito de latencia: corre de madrugada y se lee en la mañana. Además es la llamada más cara del día (procesa el contexto del día completo). Batch es un ahorro gratis del 50%. |
| D-011 | 2026-08-07 | **Alertas de presupuesto como requisito de producto:** avisar al 90% consumido, actuar al 100%. | Requisito explícito del dueño (planteado como 10% restante / 100% consumido). Nota de implementación: la API de Anthropic **no** envía avisos de saldo; la app tiene que acumular el gasto por su cuenta desde el objeto `usage` de cada respuesta. |
| D-012 | 2026-08-07 | Capa de abstracción de proveedor de modelo desde el día uno. Cambiar de proveedor = editar un archivo de configuración, no reescribir la app. Solo Claude por ahora. | Confirmado por el dueño (formaliza D-007). |
| D-013 | 2026-08-07 | **La compresión de contexto (Headroom) corre en tiempo de ESCRITURA, nunca en tiempo de request.** Se comprime el contexto estable una vez, se guarda comprimido y eso es el prefijo cacheado. | Comprimir en cada request produce un prefijo variable, lo que destruye los aciertos de caché. Ver §6e: una compresión que rompe el caché es *peor* que solo cachear. |
| D-014 | 2026-08-07 | **Nunca comprimir el documento bajo análisis.** La compresión aplica solo a datos a granel o estructurados (exports de chat, volcados de QuickBooks, logs). | "Sin pérdida de precisión" es creíble para código (la reducción por AST es semánticamente equivalente) y para JSON. Es una afirmación mucho más fuerte sobre lenguaje natural. En un análisis de riesgo contractual el riesgo vive en la letra chica; en el chat de empleados el tono y lo que se calla son señal. |
| D-015 | 2026-08-07 | **Segmento objetivo: negocios de 1 a 15 personas, cualquier industria.** | El hilo común no es la industria: por debajo de ~15 personas el dueño *es* toda la capa gerencial. No hay CFO, ni gerente de operaciones, ni junta, ni un par con quien contrastar. Ese vacío es lo que llena el producto. |
| D-016 | 2026-08-07 | **No construir lógica de negocio vertical. Construir preguntas de onboarding conscientes del sector.** | El LLM ya trae el conocimiento del dominio (costo primo de restaurante, retenciones de constructora, tasa de utilización de agencia). Lo que falta son las preguntas correctas para conectar ese conocimiento con *esta* empresa. Acordado explícitamente con el dueño. |
| D-017 | 2026-08-07 | **El onboarding es una entrevista conversacional a cargo de UN solo asesor**, con lista de completitud por debajo e indicador de avance visible. | Un formulario de 30+ campos se abandona. Una conversación libre no garantiza cobertura. Un solo entrevistador (persona tipo jefe de gabinete) evita abrumar e introduce el concepto multi-asesor de forma suave. |
| D-018 | 2026-08-07 | **El onboarding propone y corrige, no pregunta y transcribe.** El sistema lee el sitio web de la empresa y los estados financieros subidos, redacta un perfil y le pide al dueño que lo corrija. | Corregir es ~10× más rápido que redactar, y produce el momento "mágico" dentro de los primeros tres minutos. |
| D-019 | 2026-08-07 | **El onboarding va por capas. Capa 1 = 15–20 minutos, sin acompañamiento. Todo lo demás se acumula bajo demanda.** | Restricción del dueño: 15–20 min, sin nadie al lado. La lista completa de datos (nombre/puesto/salario/horario por empleado) son 50+ datos para una empresa de 10 personas: 20 minutos solo eso. |
| D-020 | 2026-08-07 | **Pedir cada dato en el momento en que se vuelve necesario, no de entrada.** El roster de empleados cuando se conecta el primer chat; los salarios la primera vez que surge una pregunta de nómina o de caja. | Mantiene corta la Capa 1 y refuerza el pilar de Iniciativa: el board pide lo que necesita, cuando lo necesita. El onboarding nunca "termina", y eso es virtud. |
| D-021 | 2026-08-07 | **El primer entregable es un hallazgo no solicitado, no un resumen de lo que el sistema entendió.** Correr la conciliación de caja contra utilidad (Caso C) sobre los estados recién subidos. | Un resumen es un espejo, no valor: el dueño ya sabe de qué se trata su negocio. El diagnóstico usa datos ya entregados, demuestra los tres pilares de una vez y es falsable. |
| D-022 | 2026-08-07 | **La primera sesión tiene que crear el primer compromiso rastreado.** | Si no, el pilar de Rendición de Cuentas queda teórico. El ciclo de seguimiento tiene que arrancar el día uno. |
| D-023 | 2026-08-08 | **Agregar el Caso D — dirección / fijar la agenda** como caso de uso de primera clase, distinto de A/B/C. | Corrección del dueño. A–C son "tengo una pregunta concreta"; D es "no sé cuál es la pregunta". D es lo que hace una junta de verdad y un consultor puntual no. |
| D-024 | 2026-08-08 | **Premisa 1 reescrita: el valor es criterio experto anclado en este negocio; la defendibilidad es el seguimiento. Ninguna alcanza sola.** | La redacción original colapsaba el producto en su pilar más defendible y borraba su valor principal. Si hubiera llegado así a `/plan-eng-review`, el modelo de datos habría quedado optimizado para compromisos, con la guía experta tratada como un chat genérico encima. |
| D-025 | 2026-08-08 | **Construir primero para el dueño; la comercialización es secundaria.** Se arranca a construir sin la tarea de validación de dos semanas. | Decisión del dueño, y el razonamiento se sostiene: él es el usuario, así que la demanda no hay que descubrirla. Las Premisas 2 y 5 quedan DIFERIDAS, no refutadas: bloquean vender, no construir. |
| D-026 | 2026-08-08 | **Las banderas de privacidad (salarios, consentimiento de empleados) son riesgo casi nulo mientras sea de un solo inquilino, y vuelven completas en el momento en que entren datos de una segunda empresa.** No borrarlas de Preguntas Abiertas. | Su empresa, sus datos, su decisión. La obligación no desapareció, está dormida. |
| D-027 | 2026-08-08 | **Alcance recortado de 6 subsistemas a 4.** Se difieren: resumen nocturno, ingesta de exports de WhatsApp, chat multi-asesor, interfaz multi-idioma, cifrado de API keys y Headroom. | El resumen nocturno no tiene fuente de datos diaria en la Aproximación A: resumiría nada. El onboarding conversacional sirve a usuarios futuros, no al dueño. Ninguno difiere aprendizaje. |
| D-028 | 2026-08-08 | **Estados financieros: extracción nativa con Claude + validación aritmética + confirmación visible antes de cualquier consejo.** Sin librería de parseo. | La extracción es la ruta crítica de la Premisa 4, no un caso borde. Un balance mal leído produce consejos convincentes y equivocados que el dueño no tiene cómo detectar. |
| D-029 | 2026-08-08 | **Seguimiento: cálculo en cada renderizado (siempre), más una llamada programada de GitHub Actions a un endpoint autenticado.** El cron del servidor reemplaza el disparador al comercializar. | El cron de tier gratuito falla en silencio, y el pilar de rendición de cuentas fallando en silencio se leería como fallo de producto. El barrido tiene que ser independiente de quién lo dispara. |
| D-030 | 2026-08-08 | **Columna `owner_id` en todas las tablas desde el día uno; cero interfaz de autenticación.** | "Un solo inquilino" contradecía "el dueño más un círculo cercano". La columna no cuesta nada hoy y cuesta una migración sobre datos reales después. Mismo razonamiento que las entidades de primera clase. |
| D-031 | 2026-08-08 | **El prefijo cacheado es una foto inmutable versionada, renderizada al escribir, con una prueba que falla si baja de 4096 tokens.** | La estabilidad byte a byte y un perfil que evoluciona se contradicen; versionar lo resuelve. Bajo 4096 tokens Haiku 4.5 deja de cachear en silencio y cobra precio completo sin dar error. |
| D-032 | 2026-08-08 | **Sin freno duro de presupuesto en la app. Solo contar y avisar. Guardar el estado antes de cada llamada al modelo; al agotarse los créditos, mensaje claro y recuperación manual tras recargar.** | Corrección del dueño: tiene otras apps con la misma API key, así que una alerta al 90% propia nunca dispararía antes de que el saldo compartido llegue a cero. La protección real es la recarga automática en la consola de Anthropic. |
| D-033 | 2026-08-08 | **Estados de compromiso: pendiente, hecho, vencido, pospuesto (fecha nueva), descartado (motivo obligatorio).** `vencido` se calcula, nunca se guarda. | El campo "status" se mencionaba pero nunca se definía. El motivo de descarte es el campo de mayor señal del sistema: el registro de qué consejo se rechazó y por qué. |
| D-034 | 2026-08-08 | **Asesores: base compartida + delta por asesor (nombre, especialidad, qué datos ve, y qué NO es lo suyo).** Finanzas se define ahora; el resto son nombres hasta la primera consulta. | Archivos de personaje independientes duplican el contexto del negocio y se desincronizan. El campo "qué no es lo suyo" evita que el asesor financiero opine sobre un contrato con seguridad falsa. |
| D-035 | 2026-08-08 | **Cada recomendación guarda la versión de configuración del asesor y el modelo usado, junto al mensaje origen y la foto de los datos.** | Sin eso no se puede distinguir una recomendación mala por datos malos de una mala por instrucciones malas. No es reconstruible después. |
| D-036 | 2026-08-08 | **El endpoint del barrido se autentica con una clave secreta compartida** (secretos de GitHub + variables del hosting). | Es alcanzable desde internet. Sin autenticación, cualquiera que lo encuentre puede dispararlo o leer datos de compromisos. |
| D-037 | 2026-08-08 | **Extraer todos los renglones del estado financiero en la primera pasada, no solo los totales.** | El Caso C es una pregunta de renglón. Extraer solo resúmenes forzaría a reenviar el PDF completo en la consulta más importante del producto, a ~10× el costo. |
| D-038 | 2026-08-08 | **La primera lectura se escribe en pantalla mientras se genera.** | Puede tardar minutos. Una rueda girando ese tiempo se lee como que se colgó y el dueño recarga. |
| D-039 | 2026-08-10 | **Hilos de chat (y comentarios por párrafo) viven en la BD de la app**, igual que los compromisos. Exportar/importar archivo a carpeta local es respaldo opcional, no la fuente de verdad. | El caché del navegador se borra; vigilar una carpeta del disco es frágil (permisos, rutas, el browser no puede hacerlo bien). Confirmado por el dueño. |

---

## 6. HALLAZGO CLAVE #1 (EUREKA) — 2026-08-07 — REVISADO

**Afirmación original:** la integración de datos en vivo no es el valor central; es un
insumo.

**El dueño respondió con un contraejemplo y tenía razón.** El Caso C de abajo necesita
el panorama contable *completo*, no una rebanada. La afirmación se había sobrecorregido.

### Caso C — Conciliación de caja contra utilidad (contraejemplo del dueño)
"Mi sistema de contabilidad dice que tengo 50,000 de ganancias en lo que va del año,
pero solo tengo 3,000 en el banco y 10,000 en cuentas por cobrar. ¿Dónde está el resto
del dinero?"

Es la brecha clásica entre utilidad y caja en la empresa pequeña. La respuesta está en
lo que el estado de resultados **no** muestra: inventario, cuentas por cobrar, retiros
del dueño, pagos a principal de deuda, compras de equipo. Un asesor financiero que corra
esa conciliación automáticamente tiene valor real, y eso requiere acceso profundo a
QuickBooks, no tres números.

### Caso D — Dirección / fijar la agenda (agregado 2026-08-08 tras corrección del dueño)

> *"A veces no sé qué se debe hacer ante X circunstancia, y quiero poder preguntar al
> board que me diga ahora qué hay que hacer para avanzar, o en base a su conocimiento e
> información de la empresa que me hagan un plan de cómo podemos aumentar nuestras
> ventas un 5%, o consejos de en qué estamos gastando mucho dinero que no es necesario
> y cómo mejorar utilidad."*

**Estructuralmente distinto de A, B y C.** Esos tres son "tengo una pregunta concreta".
El D es "ni siquiera sé cuál es la pregunta". A–C son apoyo a la decisión; D es **fijar
la agenda**, y es el modo al que un dueño solo no tiene acceso de ninguna forma. Es lo
que hace una junta directiva de verdad y que un consultor contratado para una pregunta
puntual no hace.

Datos que requiere: todo el contexto del negocio más los datos financieros y operativos
que estén conectados. Atraviesa los tres niveles de abajo en vez de vivir en uno solo.

**Por qué casi se pierde:** al inicio quedó metido como sub-punto dentro del pilar de
Iniciativa. El dueño lo corrigió: la mitad de guía y dirección es el *valor principal*,
no un efecto secundario de la proactividad. Ver el encuadre revisado en §6b.

### Encuadre corregido: las preguntas vienen en niveles, cada nivel necesita distinta profundidad

| Nivel | Ejemplo | Datos necesarios |
|-------|---------|------------------|
| 1. Criterio | Caso B — el contrato con cláusulas de multas | **Ninguno** de ningún sistema. Documento + contexto del negocio |
| 2. Decisión de caja | Caso A — contratar ahora o después de ganar | Tres números y un calendario de cobros |
| 3. Forense | Caso C — dónde se fue la plata | **Panorama contable completo** |

**Lo que sobrevive del hallazgo original:** el *orden de construcción*. Una versión que
exige tres integraciones antes de entregar valor nunca sale. Se empieza en el Nivel 1
(usable desde el primer día), luego Nivel 2, luego Nivel 3.

**Lo que cambió:** el Nivel 3 es un destino real, no alcance inflado. La integración
profunda con QuickBooks está en el roadmap, solo que no de primera.

---

## 6b. HALLAZGO CLAVE #2 (EUREKA) — 2026-08-07 — LA DEFINICIÓN DEL PRODUCTO

**Esta es la conclusión más importante de la sesión.**

Al preguntarle qué hace hoy cuando le cae una decisión difícil, el dueño respondió:

> *"No le pregunto a nadie, la decisión la tomo yo a puro instinto."*
> *"Pueden pasar una semana, 2 o 3."*
> *"Más que no tener a quién consultarle es no tener alguien que me guíe **después** de
> tomar la decisión."*

Al preguntarle por qué no pega el contrato en Claude.ai y ya:

> *"Claude no tiene el panorama completo, y no puedo ponerme a explicarle cada vez."*
> *"Si les pido que todos los lunes me manden X reporte automáticamente sin yo tener
> que solicitarlo."*
> *"Que a los 10 días me pidan información de lo que solicitaban, y si no está hecho,
> **insistan** en la importancia de por qué hay que hacerlo."*

**El producto no es un chat. Es un sistema de rendición de cuentas con memoria y agenda
propia.** Tres pilares:

1. **Memoria** — conoce el negocio; el dueño no vuelve a explicar nada nunca.
2. **Iniciativa** — habla primero. Reportes programados, observaciones sin que se las
   pidan, temas de agenda que el dueño no pensó en preguntar ("aquí hay un plan para
   subir ventas 5%", "aquí es donde estás gastando de más").
3. **Seguimiento** — se acuerda de lo que recomendó, le da rastreo al compromiso y
   vuelve a preguntar. Si a la fecha no está hecho, insiste y explica por qué importa.

**El pilar 3 es el más difícil de copiar. No es el más valioso.** — *corregido
2026-08-08.*

La versión original de esta sección decía "el pilar 3 es el foso" y colapsaba el
producto entero en él. El dueño lo corrigió:

> *"La app no es sólo para obligarme a dar seguimiento, es para darme dirección cuando no
> sé cómo actuar y me ayude según la experiencia de expertos en distintos temas a darme
> una respuesta y una guía para ayudarme a fortalecer y crecer mi empresa."*

**Valor y diferenciación son preguntas distintas:**

| Pregunta | Respuesta |
|----------|-----------|
| ¿Por qué abrir la app? | Criterio experto en finanzas, mercadeo, operaciones y administración, aplicado a *esta* empresa, más dirección cuando el dueño no sabe qué hacer (Caso D) |
| ¿Por qué esta y no Claude.ai, que ya tiene? | Memoria (nunca volver a explicar), iniciativa (habla primero), seguimiento (vuelve a preguntar) |

Guía sin memoria es Claude.ai. Memoria sin seguimiento es un cuaderno mejor. Seguimiento
sin buena guía es una molestia. **El producto son los tres.**

Claude.ai no tiene ninguno de los tres. Casi todos los productos de "AI advisor" tienen,
en el mejor caso, el primero. Nadie entrega el tercero, y por eso es el más defendible,
aunque la razón por la que el usuario abre la app sea la guía.

> Un asesor que te da un consejo y nunca vuelve a preguntar no es un asesor, es un
> buscador. Pero un asesor que solo insiste y no tiene criterio tampoco es un asesor:
> es un calendario.

**Consecuencia:** el modelo de datos necesita objetos de primera clase para
**recomendaciones**, **compromisos** y **estado de seguimiento**, no solo mensajes.
Esto es requisito de arquitectura, no una función para pegar después.

---

## 6c. Análisis de Costo del LLM y Selección de Modelo — 2026-08-07

Precios de la API de Anthropic, por millón de tokens (verificados contra la
documentación vigente el 2026-08-07):

| Modelo | Entrada | Salida | Contexto |
|--------|---------|--------|----------|
| Claude Haiku 4.5 | $1.00 | $5.00 | 200K |
| Claude Sonnet 5 | $3.00 | $15.00 | 1M |
| Claude Opus 5 | $5.00 | $25.00 | 1M |

**Costo mensual estimado, un solo usuario, ~10 consultas diarias + resumen nocturno:**

| Estrategia | Estimado |
|------------|----------|
| Todo en Haiku 4.5 | $3–5/mes |
| Enrutado (Haiku rutina, Sonnet asesoría) | $8–12/mes |
| Todo en Opus 5 | $20–25/mes |

*Supuestos: prefijo estable de contexto de negocio de ~5K tokens (cacheado), ~1K de
entrada nueva y ~1K de salida por consulta, ~20–30K de entrada para el resumen
nocturno. Hay que recalibrar contra uso real antes de tratarlos como cifras de
presupuesto.*

### Prompt caching — la palanca de costo dominante para este producto

Las lecturas de caché cuestan ~10% del precio normal de entrada. Las escrituras cuestan
1.25× (TTL de 5 minutos) o 2× (TTL de 1 hora). Como el prefijo de contexto del negocio
se reenvía en cada llamada, el caché convierte al "board que conoce tu negocio" de ser
la mayor línea de costo a ser un error de redondeo.

**Restricción de diseño que se desprende:** el prefijo cacheado tiene que ser
**estable byte por byte**. Nada de timestamps, ni UUIDs, ni interpolación por request
antes del contenido estable; cualquier cambio de un byte invalida todo el prefijo.

**El mínimo cacheable depende del modelo** y esto muerde en silencio (no da error,
simplemente no cachea):

| Modelo | Prefijo mínimo cacheable |
|--------|--------------------------|
| Claude Opus 5 | 512 tokens |
| Claude Sonnet 5 | 1024 tokens |
| Claude Haiku 4.5 | 4096 tokens |

Si el prefijo de contexto del negocio queda por debajo de 4096 tokens, en Haiku 4.5 no
cachea.

### Alternativas no-Anthropic consideradas

El dueño planteó DeepSeek y marcó preocupación de seguridad de datos con empresas chinas.

- **DeepSeek** — la preocupación es legítima para datos del negocio, pero los pesos del
  modelo son abiertos: se pueden correr en inferencia alojada en EE.UU. (Together,
  Fireworks), lo que elimina por completo el riesgo de residencia de datos. No elimina
  la pregunta de si el modelo razona suficientemente bien sobre riesgo contractual y
  financiero.
- **Google Gemini Flash** — tiene tier gratuito real vía AI Studio, pero la data del
  tier gratis puede usarse para entrenamiento. Hay que leer los términos antes de pasar
  finanzas de la empresa por ahí.
- **Mistral** — francesa, amigable con GDPR, barata.
- **Modelos mini de OpenAI** — EE.UU., precio competitivo.

**Decisión: ver D-007.** Sin segundo proveedor para el POC; se construye la capa de
abstracción en su lugar.

---

## 7. Análisis de Opciones de WhatsApp (2026-08-07)

| # | Opción | ¿Ve chats personales/grupos? | Legal | Costo | Veredicto |
|---|--------|------------------------------|-------|-------|-----------|
| 1 | WhatsApp Business Platform (Cloud API) | No — solo mensajes enviados a un número de negocio registrado | Sí | Gratis para mensajes iniciados por el usuario dentro de 24h | Viable, pero obliga a cambiar el hábito del equipo |
| 2 | BSP (Twilio, 360dialog) | Mismos límites que #1 | Sí | Agrega costo | Descartada — no aporta capacidad extra |
| 3 | Librerías no oficiales (whatsapp-web.js, Baileys) | Sí, todo | **No — viola términos de servicio** | Gratis | **Descartada para el producto.** Riesgo de baneo, se rompe con cambios de Meta |
| 4 | Exportar chat manual (.txt) + subirlo | Sí, lo que el usuario exporte | Sí — es data propia del usuario | Gratis | **Recomendada para el MVP.** Fea, manual, funciona hoy |
| 5 | Mover el canal de reportes a Telegram Bot API | Sí, acceso total al grupo | Sí | Gratis | **Recomendada para v2.** Una semana de cambio de hábito para un equipo de 4 |

---

## 6d. Arquitectura de Control de Costo — 2026-08-07

Cuatro mecanismos, todos disponibles en la API de Claude de primera parte.

### 1. Prompt caching (D-008)
Lecturas de caché ~10% del precio de entrada. Requiere un prefijo de contexto de negocio
estable byte por byte. Mínimos por modelo: Opus 5 = 512 tokens, Sonnet 5 = 1024,
Haiku 4.5 = 4096.

### 2. Escalamiento automático de modelo (D-009)

**Mecanismo A — Herramienta advisor** (header beta `advisor-tool-2026-03-01`). Empareja
un modelo **ejecutor** barato con un modelo **asesor** más capaz que se consulta a mitad
de generación. El ejecutor genera casi todos los tokens; el asesor entra para el
razonamiento duro. Emparejamiento propuesto: ejecutor `claude-haiku-4-5`, asesor
`claude-opus-5`.

> Restricción: el modelo asesor debe ser **al menos tan capaz** como el ejecutor.
> Haiku-ejecutor + Opus-asesor es válido. Al revés devuelve 400.
> No disponible en Amazon Bedrock, Vertex AI ni Microsoft Foundry — solo API de primera parte.

**Mecanismo B — Enrutamiento por clasificación previa.** Una llamada corta y barata a
Haiku clasifica la pregunta entrante por nivel (criterio / caja / forense) y enruta al
modelo correcto antes de la llamada real. Más simple y barato que la herramienta advisor;
los dos pueden convivir.

### 3. Batch API para el resumen nocturno (D-010)
50% más barato que el precio estándar. La mayoría de los lotes termina en menos de una
hora, máximo 24. El resumen no tiene requisito de latencia, así que es un ahorro gratis
en la llamada más grande del día.

### 4. Seguimiento de presupuesto y alertas (D-011)

**La API de Anthropic no avisa cuando se acaba el crédito.** No hay webhook de saldo.
La app tiene que llevar la cuenta:

1. Cada respuesta trae un objeto `usage`: `input_tokens`, `output_tokens`,
   `cache_read_input_tokens`, `cache_creation_input_tokens`.
2. Multiplicar por la tarifa del modelo que atendió la llamada.
3. Acumular contra un presupuesto mensual configurado por el usuario.
4. Alertar al 90%. Actuar al 100%.

**Mejora sobre lo pedido originalmente:** alertar sobre **presupuesto en dólares**, no
sobre conteo de tokens. Los tokens no significan nada para el usuario final; los dólares
sí son lo que administra.

**ABIERTO — ¿qué pasa al 100%?** Cuatro opciones, el dueño no ha decidido:

| Opción | Compensación |
|--------|--------------|
| Apagado total | Cero sobregasto, pero el board muere justo cuando la decisión es urgente |
| Degradar solo a Haiku | Sigue funcionando, más barato, respuestas menos afiladas |
| Seguir y avisar | El usuario mantiene el control; riesgo de facturas sorpresa |
| **Pausar automatización, dejar el chat** (recomendada) | Se detienen resúmenes y reportes programados; el chat manual sigue vivo |

---

## 6e. Compresión de Contexto — evaluación de Headroom — 2026-08-07

**Herramienta:** Headroom, de Tejas Chopra (ingeniero senior de Netflix). Apache 2.0,
publicada en enero 2026. Es un proxy local-first que comprime el contexto antes de que
llegue al LLM, con seis motores: reducción de código con conocimiento de AST,
optimización de JSON y un compresor de texto basado en HuggingFace. Afirma 60–95% de
reducción de tokens "sin pérdida de precisión". ~39 mil estrellas en GitHub en cinco meses.

Fuentes: [The Register](https://www.theregister.com/ai-ml/2026/05/31/netflix-wiz-creates-app-to-slash-ai-bills-then-open-sources-it/5248702) ·
[Open Source For You](https://www.opensourceforu.com/2026/06/netflix-engineer-open-sources-ai-cost-cutting-tool/) ·
[HackerNoon](https://hackernoon.com/a-netflix-engineer-built-a-free-tool-that-cuts-your-ai-token-bill-by-88percent)

### El conflicto: compresión contra prompt caching

El caché funciona por **coincidencia exacta de prefijo**. Un byte distinto invalida todo
lo que sigue. Comprimir en cada request produce un prefijo variable y por lo tanto nunca
acierta el caché. La economía se voltea:

| Estrategia | Costo relativo de entrada |
|------------|--------------------------:|
| Sin caché, sin compresión | 100 |
| Solo caché (lectura a 0.1×) | **10** |
| Solo compresión (88%) | 12 |
| Compresión **+** caché | **1.2** |
| Compresión que rompe el caché | 12 ← peor que solo caché |

**Resolución (D-013):** comprimir el contexto estable **una vez, al escribirlo**;
guardar el artefacto comprimido; usarlo como prefijo cacheado. Nunca comprimir dentro
del camino del request.

**Dónde sí paga la compresión:** en las cargas volátiles que de todos modos no cachean
bien — el export diario de WhatsApp, el volcado de QuickBooks, los logs.

**Dónde está prohibida (D-014):** cualquier documento que se le pida al board analizar
en detalle. El riesgo contractual vive en la letra chica; en el chat de empleados, el
tono y lo que se calla son señal, no ruido.

---

## 6f. Diseño del Onboarding — 2026-08-07

**Restricción (dueño):** 15–20 minutos, sin acompañamiento. Sin sesión guiada.

### Por qué tiene que ir por capas
La lista completa de datos que pidió el dueño — descripción del negocio, tipos de
cliente, tipos de proyecto, día a día, constitución de la empresa, cantidad de empleados,
y por cada empleado nombre / puesto / función / salario / horario, más problemas,
fortalezas y competencia — son 50+ datos para una empresa de 10 personas. Solo el roster
se come todo el presupuesto de tiempo.

### Capa 1 — los 15–20 minutos
- Qué hace el negocio, quién le compra, cómo se ve un proyecto típico
- Tamaño y estructura gruesa: cuánta gente y qué funciones. **Sin nombres ni salarios.**
- Las tres cosas que no dejan dormir al dueño
- Subida de estados financieros (varios años, mejor — sugerencia del dueño)
- Competencia: solo nombres y URLs; el sistema los investiga

### Capa 2 — se acumula bajo demanda (D-020)
- Roster con nombres y puestos → se pide cuando se conecta la primera fuente de chat
- Salarios → se piden la primera vez que surge una pregunta de nómina o de caja
- Horarios → se piden cuando surge la primera pregunta de operación

### Mecánica
- **Un solo entrevistador, no el board completo** (D-017). Una persona tipo jefe de
  gabinete conduce la entrevista y después presenta al equipo. Una entrevista grupal de
  siete asesores abruma.
- **Conversación arriba, checklist abajo** (D-017). La entrevista se adapta — salta lo
  ya deducido, insiste donde la respuesta fue vaga — mientras una lista de completitud
  dirige la cobertura y un indicador de avance muestra lo que falta.
- **Proponer, no preguntar** (D-018). Ingerir el sitio web de la empresa y los estados
  subidos, redactar el perfil y mostrarlo: *"esto es lo que entendí, corregime lo que
  esté mal."*

### Entregable de primera corrida — "Primera lectura del board" (D-021, D-022)
No un resumen de lo que el sistema entendió; eso es un espejo, no valor. En su lugar,
correr la conciliación de caja contra utilidad (Caso C) sobre los estados recién subidos
y devolver una página:

1. **Tres observaciones**, cada una anclada a un número real de los estados. No "tus
   márgenes podrían mejorar", sino *"tu utilidad creció 18% pero tus cuentas por cobrar
   crecieron 40%: estás vendiendo más y cobrando peor."*
2. **Una pregunta** que el board necesita respondida para profundizar — establece que la
   relación es de ida y vuelta.
3. **Una recomendación con fecha**, que se convierte en el primer compromiso rastreado.

**La vara:** el dueño tiene que querer contarle a alguien lo que le dijo el board. Si la
primera lectura sale genérica, el producto está muerto en el minuto uno.

---

## 7b. EL SUPUESTO CRÍTICO — horizontal contra vertical — 2026-08-07

Posición del dueño sobre a quién sirve el producto:

> *"Es muy probable que cada usuario tenga un negocio diferente, pero lo que sí deben
> tener en común es que es para negocios pequeños de 1 a 10 o 15 personas."*
> *"La afilada viene de la información que el usuario le vaya a brindar al sistema."*

Esta es la apuesta **horizontal**: el producto no se especializa por industria. Se
especializa **por usuario**, vía el contexto de negocio que cada quien carga. Los datos
de un cliente no están en el sistema de otro.

**No es una posición ingenua.** Con software tradicional, construir lógica por vertical
sería prohibitivo. Con un LLM, el razonamiento financiero, operativo y de riesgo
generaliza genuinamente mejor que la mayoría del software. La apuesta tiene fundamento.

**Pero contiene el supuesto más crítico de todo el producto:**

> **Que un asesor genérico, alimentado con contexto que el usuario le da, produce
> consejos afilados, y no consejos genéricos con los nombres del usuario adentro.**

El riesgo concreto: un asesor financiero para un contratista de instalación razona sobre
retenciones de garantía, facturación por avance de obra y costeo por proyecto. Para un
restaurante es costo de alimentos, costo primo y merma. Para una agencia es utilización
y realización. Si los prompts de las personas asesoras son genéricos, las tres podrían
recibir la misma respuesta de manual, inútil para todas.

**Estado: SIN COMPROBAR en ninguna dirección.** Es barato de comprobar sin construir
nada (ver La Tarea). Si este supuesto falla, falla el producto entero, así que se
comprueba antes de escribir código.

---

## 8. Preguntas Abiertas

*(Lista viva. Los puntos pasan a Decisiones cuando se resuelven.)*

- ¿Quién es el segundo cliente, después del dueño? *(Dueño 2026-08-07: todavía sin
  definir. Probablemente cada uno de industria distinta, todos en el rango de 1–15
  personas — ver D-015.)*

### Legal / privacidad — marcado 2026-08-07, va para `/cso`

Esto **no bloquea el POC** (un solo dueño, su propia empresa, sus propios datos) pero
cambia la arquitectura si se posterga más allá de esa etapa. Hay que decidirlo antes de
vender el producto.

- **Guardar salarios por empleado.** La lista de datos del dueño incluye nombre y
  salario por empleado. En un SaaS multi-tenant eso es data sensible de empleo: sube la
  vara de cifrado en reposo, control de acceso, bitácora de auditoría y exposición ante
  una filtración. Hay que decidir si los salarios se guardan como cifra, como banda, o
  se derivan bajo demanda desde la nómina de QuickBooks sin persistirlos.
- **Consentimiento de empleados para ingerir chats.** Los empleados no consintieron que
  sus mensajes se procesen con IA. En su propia empresa el dueño puede tomar esa
  decisión. Cuando esto sea un producto que se le vende a *otros* dueños, cada cliente
  está subiendo conversaciones de terceros al sistema del proveedor, y la
  responsabilidad ya no es solo del cliente. Hace falta una postura (flujo de
  consentimiento, requisito de aviso, u obligación documentada del cliente) y revisar la
  jurisdicción: la empresa del dueño parece operar en Latinoamérica, así que aplica la
  ley local de protección de datos, no solo GDPR/CCPA.

- **La API de Claude no tiene tier gratuito.** Estimado de $5–30/mes para un solo
  usuario (chat diario + resumen nocturno). Todo lo demás (hosting, base de datos,
  auth, sandbox de QuickBooks) puede ser gratis. ¿Cómo se concilia esto con la
  restricción de "no quiero pagar nada"?
- ¿Cuál es la versión más pequeña que entrega valor en la primera semana?
- ¿Cuál app de administración de proyectos específicamente?
- ¿Dónde está el valor real: en el resumen nocturno o en el chat en vivo?
- ¿Cuáles perfiles de asesor importan de verdad para una empresa de instalación de 4 personas?

---

## 6. Riesgos Detectados Temprano

- **El acceso a WhatsApp es la incógnita técnica y legal más grande.** La plataforma
  oficial de WhatsApp Business no expone chats personales ni grupales arbitrarios.
  Si el plan depende de leer chats normales de empleados, ese supuesto hay que
  verificarlo antes de construir cualquier otra cosa.
- **Pedir las API keys del usuario es fricción pesada.** Pedirle a un dueño de negocio
  no técnico que consiga y pegue credenciales de Claude y QuickBooks antes de ver
  cualquier valor es un asesino de conversión conocido.
- **El alcance es tamaño plataforma, no tamaño MVP.** Tres integraciones, chat
  multi-agente, resumen nocturno y reportes con gráficas no es un primer release.

---

## 9. Estado de Completado / Pendiente

### ✅ Completado 

**Sesión 2026-08-08 — /plan-eng-review + Repositorio & Business Context**

**Decisiones cerrradas en revisión de ingeniería:**
| # | Fecha | Decisión | 
|---|-------|----------|
| D-027 | 2026-08-08 | **Alcance recortado de 6 subsistemas a 4.** Se difieren: resumen nocturno, ingesta de exports de WhatsApp, chat multi-asesor, interfaz multi-idioma, cifrado de API keys y Headroom. | 
| D-028 | 2026-08-08 | **Estados financieros: extracción nativa con Claude + validación aritmética + confirmación visible antes de cualquier consejo.** Sin librería de parseo. | 
| D-029 | 2026-08-08 | **Seguimiento: cálculo en cada renderizado (siempre), más una llamada programada de GitHub Actions a un endpoint autenticado.** El cron del servidor reemplaza el disparador al comercializar. |
| D-030 | 2026-08-08 | **Columna `owner_id` en todas las tablas desde el día uno; cero interfaz de autenticación.** "Un solo inquilino" contradecía "el dueño más un círculo cercano". La columna no cuesta nada hoy y cuesta una migración sobre datos reales después. |
| D-031 | 2026-08-08 | **El prefijo cacheado es una foto inmutable versionada, renderizada al escribir, con una prueba que falla si baja de 4096 tokens.** |
| D-032 | 2026-08-08 | **Sin freno duro de presupuesto en la app. Solo contar y avisar.** Guardar el estado antes de cada llamada al modelo; al agotarse los créditos, mensaje claro y recuperación manual tras recargar. |
| D-033 | 2026-08-08 | **Estados de compromiso: pendiente, hecho, vencido, pospuesto (fecha nueva), descartado (motivo obligatorio).** `vencido` se calcula, nunca se guarda. |
| D-034 | 2026-08-08 | **Asesores: base compartida + delta por asesor** (nombre, especialidad, qué datos ve, y qué NO es lo suyo). Finanzas se define ahora; el resto son nombres hasta la primera consulta. |
| D-035 | 2026-08-08 | **Cada recomendación guarda la versión de configuración del asesor y el modelo usado**, junto al mensaje origen y la foto de los datos. |
| D-036 | 2026-08-08 | **El endpoint del barrido se autentica con una clave secreta compartida** (secretos de GitHub + variables del hosting). |
| D-037 | 2026-08-08 | **Extraer todos los renglones del estado financiero en la primera pasada**, no solo los totales. |
| D-038 | 2026-08-08 | **La primera lectura se escribe en pantalla mientras se genera.** Puede tardar minutos. Una rueda girando ese tiempo se lee como que se colgó y el dueño recarga. |

**Hallazgos de arquitectura cerrados:**
- H5: Capa de modelo — resuelto en D-030/034
- H6: Máquina de estados — resuelto en D-033
- H7: Estructura de asesores — resuelto en D-034
- H8: Rastreo de versión — resuelto en D-035
- H9: Seguridad del endpoint — resuelto en D-036

**Hallazgos de rendimiento cerrados:**
- H9: Streaming de primera lectura — resuelto en D-038
- H10: Reuso de estados financieros — resuelto en D-037

**Artefactos generados (08-08):**
- Design doc: 10 hallazgos, mapa de tests, modos de falla, 13 tareas
- docs/06-SYSTEM-ARCHITECTURE.md: 5 subsistemas con diagramas
- docs/07-DATA-MODEL.md: esquema completo con máquina de estados
- Plan de pruebas + tareas JSONL: ~/.gstack/projects/BoardofAdvisors/
- **BUSINESS_CONTEXT.md**: Perfil completo de Siscon (revenue, team, financials, constraints)
- **GitHub repo**: https://github.com/agoldav/board-of-advisors (inicializado, README+gitignore+LICENSE)

---

**Sesión 2026-08-09 — Implementación Tareas 1-3 (construcción en Cursor)**

**Decisión de stack:**
- **TypeScript + Node, SQL puro con `pg` (sin ORM), luxon para fechas con zona horaria.** Confirmada contra la comparación TS/Node vs Python.

**Tarea 1 — Esquema de base de datos (commit `8202b5c`):**
- `db/migrations/0001_initial_schema.sql`: 11 tablas, 8 enums, índices y constraints. PostgreSQL, puro esquema sin lógica.
- `owner_id` en todas las tablas (D-030); piso de 4096 tokens como CHECK en `profile_versions` (D-031); `vencido` prohibido como valor guardado y descarte con motivo obligatorio (D-033); set de trazabilidad en `recommendations` (D-035); extracción por renglón en `extracted_figures` (D-037); `input_state` en `llm_operations` para persist-before-call (D-029).
- `db/README.md` con uso e invariantes.

**Tarea 2 — Núcleo backend (commit `be220ec`):**
- Perfil de negocio: render determinista byte-estable + servicio de versionado que mide con el tokenizer real y falla si baja de 4096 tokens (D-008/D-031).
- Router de modelos: clasifica antes de llamar → Haiku/Sonnet/Opus (D-006/D-009); primer read a Opus (D-021). Cliente Anthropic con `cache_control`, streaming, `count_tokens`, `usage` y manejo de `refusal`.
- Máquina de estados de compromisos: transiciones validadas y `vencido` calculado en lectura con la zona horaria del dueño (D-033).

**Tarea 3 — Motor de asesores (commit `d13fc55`):**
- `askAdvisor` (chat 1:1) y `firstReading` (reconciliación de caja en streaming — D-021/D-038).
- Persist-before-call con mensaje amable de créditos agotados (D-029); recomendaciones con traza completa (D-035); `refusal` como error visible, no respuesta en blanco.
- Config de asesores en YAML versionado (finanzas completo, operaciones como stub) + registry que renderiza el delta por asesor tras el prefijo cacheado (D-034).
- Reconciliación pura: identidad contable, crecimiento período a período y detección de divergencia de caja (D-021/D-037).

**Verificación:** 32 tests unitarios en verde; `tsc` estricto limpio; el build copia los YAML a `dist/`.

---

**Sesión 2026-08-09 — Tareas 4, 8, 13 + PR #1 + operación GitHub**

**Tarea 4 — Ingesta de PDF (D-028 / D-037):**
- Extracción nativa con Claude (document block + tool forzado); todos los renglones.
- Validación aritmética; confirmación / corrección / rechazo antes de cualquier consejo.
- Guard en primera lectura: no aconseja si el balance no cuadra.

**Tarea 8 — Barrido de compromisos (D-029 / D-036):**
- Endpoint `POST /api/sweep` con secreto compartido; un email por compromiso vencido por día (idempotente).
- Workflow de GitHub Actions diario incluido en el PR.
- Secret de GitHub `SWEEP_SHARED_SECRET` creado por el dueño.

**Tarea 13 — Contador de gasto (D-032):**
- Acumula gasto desde `llm_operations.usage`; aviso ≥90% / señal ≥100%; sin freno duro.

**Entrega / repo:**
- Pull request **mergeado** (2026-08-09): https://github.com/agoldav/board-of-advisors/pull/1 → `main` (`8da7017`).
- `BUSINESS_CONTEXT.md` actualizado y metido en el PR (contexto que la app debe usar para aconsejar).
- Regla local `.cursor/rules/secrets-handling.mdc`: no subir secretos a git; en docs públicos usar `********` + “ver en archivos locales”.
- `gh` instalado y autenticado; token dedicado a esta app (separado del de otras apps).
- Verificación: 61 tests unitarios en verde; `tsc` estricto limpio.

---

**Sesión 2026-08-10 — UI: diseño, shell React, acuerdos de hilos**

**Diseño:**
- Brief para Claude Design: `docs/19-CLAUDE-DESIGN-BRIEF.md` (también en `UI Design/`).
- Handoff de diseño recibido en `UI Design/` (README + standalone + source); dirección **1a** (rail permanente) adoptada para datos/conversación.

**UI implementada (`web/` — React + Vite):**
- Pantallas: Confirmación de cifras, Primera lectura, Chat, Compromisos.
- Shell compartido: rail izquierdo + barra de preguntar; claro por defecto y oscuro.
- Settings al hacer clic en el nombre del usuario (abajo a la izquierda); selector de tema ahí.
- Datos de ejemplo (fixtures) para poder navegar sin cablear el backend todavía.
- Probar en: http://127.0.0.1:5173 (`npm run web:dev`).

**Decisiones cerradas esta sesión:**
| # | Fecha | Decisión |
|---|-------|----------|
| D-039 | 2026-08-10 | **Hilos de chat (y comentarios por párrafo) viven en la BD de la app**; export/import a carpeta local es respaldo opcional, no la fuente de verdad. |

**Acuerdos de producto (registrados, aún no construidos):** ver Pendiente — orden de construcción UI.

---

**Sesión 2026-08-11 — Hosting del barrido + secrets**

**Decisión de producto:**
- Se eliminó de Pendiente la tarea “activar recarga automática en Anthropic” (el dueño no la hará).

**Hosting (ítem 6 del orden UI + secrets inmediatos):**
- Postgres en **Neon**; esquema `0001_initial_schema.sql` aplicado.
- Web service en **Render Free**: `https://board-of-advisors-sweep.onrender.com`
- Código: `GET /health` (y `GET /`) + script `npm start` (commit `6b91bbe` en `main`).
- Secrets alineados: `.env` local, env de Render (`DATABASE_URL`, `SWEEP_SHARED_SECRET`, `OWNER_NOTIFY_EMAIL`), GitHub Secrets (`SWEEP_URL`, `SWEEP_SHARED_SECRET`).
- Workflow `commitment-sweep` disparado a mano: **verde**.

---

**Sesión 2026-08-11 — Camino dorado cableado (sin Anthropic) + panel de datos**

**Acuerdo de esta sesión:**
- Seguir con el ítem 1 de Pendiente **sin** agregar la API key de Claude todavía.
- Usar datos reales en Postgres; el LLM queda en mock hasta que el dueño conecte Anthropic.

**Backend / API:**
- `MockLlmProvider` + `LLM_PROVIDER=mock` (o Anthropic vacío → mock automático).
- Rutas HTTP del camino dorado: sesión, documento demo, confirmación/corrección de cifras, primera lectura (stream NDJSON), crear/listar/transicionar compromisos.
- Bootstrap de owner + perfil + conversación; persistencia de compromisos (`src/commitments/service.ts`).
- Seed demo de cifras balanceadas sin llamar a Claude (`POST /api/documents/demo`).

**UI cableada (`web/`):**
- Confirmación de cifras, Primera lectura y Compromisos dejan de usar solo fixtures: hablan con la API (proxy Vite → `:8787`).
- Corrección de desfase sesión/documento (Strict Mode): una sola sesión en vuelo; `documentId` atado al `ownerId`.
- Primera lectura: panel derecho reabrible (**Cifra / Tabla / Gráfica**) a la par del texto, con renglones confirmados y gráfica de composición.

**Verificación:** typecheck limpio; 64 tests en verde; humo E2E del camino dorado contra Neon OK.

---

**Sesión 2026-08-11 — Subida real de PDF + Claude**

**Acuerdo:** ítem 1 de Pendiente. `ANTHROPIC_API_KEY` en `.env` local; `LLM_PROVIDER=anthropic`.

**Backend:**
- `POST /api/documents/upload` — cuerpo binario PDF + `X-Filename` / `X-Owner-Id` → `ingestFinancialPdf` (Claude nativo; mock si no hay key).
- `GET /api/llm/status` — la UI sabe si está en mock o Anthropic.
- Límite 20 MB; rechazo si no es PDF; 422 si no es estado financiero / extracción vacía.

**UI (`Confirmación de cifras`):**
- Estado vacío con subida (clic o arrastrar). Ya no siembra demo al entrar.
- Extrae renglones, confirma / corrige / rechaza como antes. Demo queda como atajo (“usar demo”).

**Verificación:** 69 tests en verde; typecheck + `web` build limpios; ping Anthropic Haiku 4.5 OK. El dueño subió un PDF real en `http://localhost:5173/cifras` y confirmó que funcionó.

---

**Sesión 2026-08-11 — Hilos de chat en BD (D-039)**

**Ítem 1 de Pendiente.** Fuente de verdad: tablas `conversations` / `messages` (sin migración; el schema de Completado ya las tenía).

**Backend (nuevo, sin cambiar `askAdvisor` ni el bootstrap de sesión):**
- `src/conversations/service.ts` — listar / crear / renombrar / borrar / exportar / importar.
- No se puede borrar el último hilo.
- `POST /api/conversations/:id/messages` llama al `askAdvisor` existente.
- Export JSON opcional (respaldo); import crea un hilo nuevo.

**UI:**
- Rail: hilos reales + Nuevo hilo / importar / exportar / borrar.
- `/chat/:id` lee y escribe contra la API. La página de fixtures queda reemplazada.

**Sin tocar:** schema `0001`, `firstReading`, confirmación de cifras, compromisos, `ensureSession` (sigue garantizando al menos un hilo).

---

**Sesión 2026-08-12 — Comentario por párrafo**

**Ítem 2 de Pendiente.** Hilo anclado a un párrafo de la primera lectura; se puede seguir preguntando.

**Cómo (sin migración ni cambio a `askAdvisor`):**
- Ancla = mensaje `system` con prefijo `__boa_anchor_v1__` + JSON (sección, extracto, padre).
- `POST /api/conversations/paragraph` — find-or-create por `(owner, parent, sectionKey)`.
- Al enviar, el API arma el prompt con extracto + historial; guarda en BD solo la pregunta corta.
- UI: al seleccionar un párrafo en `/lectura` se abre el composer bajo el texto; respuestas quedan en el hilo; el rail anida hilos `Sobre: …` bajo el padre.

---

**Sesión 2026-08-12 — Vista documento 1b (adjunto en chat)**

**Ítem 3 de Pendiente.** Al adjuntar PDF/JPG/PNG en el chat, el layout pasa a **1b**: documento a la izquierda, asesor a la derecha (1a = solo chat/datos).

**Cómo (sin tocar schema ni extracción financiera):**
- `POST /api/conversations/:id/attachments` guarda bytes en `documents` (`kind=other`) + mensaje system `__boa_attachment_v1__`.
- `GET /api/documents/:id/file?ownerId=` sirve el original (para iframe/img).
- Chat: botón `+` habilita adjunto; abre panel `DocumentPane`; se puede cerrar y reabrir.

---

**Sesión 2026-08-12 — Integración a `main`**

- Mergeado en `main`: camino dorado + UI (PR #2), comentario por párrafo (PR #3), vista documento 1b (PR #4).
- Ítem 4 (Create advisor / section) quedó acordado en alcance pero **sin construir** en esta sesión.

---

### ⏳ Pendiente

**Construcción UI — orden acordado (2026-08-10):**
1. **Create advisor / Create section + arrastrar para anidar**, con:
   - Botones Create new advisor / Create new section activos.
   - Menú ⋮ (tres puntos) a la derecha de cada advisor y section: **Rename**, **Archive**, **Delete**, **Create Sub** (crea una sección/chat nuevo dentro del advisor o section).
   - Arrastrar para mover y anidar todos los advisors y sections.

**Diferidos a v2:**
- Resumen nocturno (Batch API)
- Ingesta de exports de WhatsApp (.txt manual)
- Chat multi-asesor
- Interfaz multi-idioma
- Cifrado de API keys en BD
- Headroom (compresión de contexto)

---

**Última actualización:** 2026-08-12 (cierre sesión: ítems 2–3 en main; ítem 4 pendiente)
