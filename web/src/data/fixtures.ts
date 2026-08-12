export type LineItem = {
  id: string;
  label: string;
  page: string;
  amount: number;
  confidence: string;
  children?: { id: string; name: string; meta: string; amount: number }[];
};

export type CommitmentStatus = "pending" | "overdue" | "done" | "postponed" | "discarded";

export type Commitment = {
  id: string;
  text: string;
  dueLabel: string;
  origin: string;
  status: CommitmentStatus;
  resolution?: string;
  thread?: { author: string; role: "owner" | "advisor"; at: string; text: string }[];
};

export const formatUsd = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

export const balanceRows: {
  activosBefore: LineItem[];
  receivable: LineItem;
  activosAfter: LineItem[];
  pasivos: LineItem[];
  patrimonio: LineItem[];
  totalActivos: number;
  totalPasivoPatrimonio: number;
} = {
  activosBefore: [
    { id: "cash", label: "Efectivo en bancos", page: "p.2", amount: 3000, confidence: "100%" },
  ],
  receivable: {
    id: "ar",
    label: "Cuentas por cobrar",
    page: "p.2",
    amount: 10000,
    confidence: "99%",
    children: [
      { id: "ar1", name: "Constructora Vega", meta: "fact. 0412 · 47 días", amount: 4200 },
      { id: "ar2", name: "Grupo Solera", meta: "fact. 0418 · 38 días", amount: 3300 },
      { id: "ar3", name: "Municipalidad de Alajuela", meta: "fact. 0421 · 31 días", amount: 2500 },
    ],
  },
  activosAfter: [
    { id: "inv", label: "Inventario de materiales", page: "p.2", amount: 18400, confidence: "97%" },
    { id: "eq", label: "Equipo y herramientas", page: "p.3", amount: 42000, confidence: "99%" },
    { id: "dep", label: "Depreciación acumulada", page: "p.3", amount: -11200, confidence: "96%" },
  ],
  pasivos: [
    { id: "ap", label: "Cuentas por pagar", page: "p.3", amount: 9800, confidence: "99%" },
    { id: "loan", label: "Préstamo bancario", page: "p.3", amount: 14500, confidence: "98%" },
    { id: "tax", label: "Impuestos por pagar", page: "p.3", amount: 2300, confidence: "97%" },
  ],
  patrimonio: [
    { id: "cap", label: "Capital social", page: "p.4", amount: 5000, confidence: "100%" },
    { id: "re", label: "Utilidades retenidas", page: "p.4", amount: 30600, confidence: "98%" },
  ],
  totalActivos: 62200,
  totalPasivoPatrimonio: 62200,
};

export const pnlRows: LineItem[] = [
  { id: "rev", label: "Ingresos por servicios", page: "p.5", amount: 214800, confidence: "99%" },
  { id: "cogs", label: "Costo de ventas", page: "p.5", amount: 131500, confidence: "98%" },
  { id: "opex", label: "Gastos operativos", page: "p.6", amount: 28900, confidence: "97%" },
  { id: "depr", label: "Depreciación del periodo", page: "p.6", amount: 3200, confidence: "99%" },
  { id: "fin", label: "Gastos financieros", page: "p.6", amount: 1200, confidence: "98%" },
];

export const pnlNet = 50000;

export const composition = [
  { key: "costo", label: "costo", pct: 61.2, color: "var(--steel)" },
  { key: "gastos", label: "gastos", pct: 13.5, color: "var(--slate)" },
  { key: "otros", label: "otros", pct: 2.1, color: "var(--muted)" },
  { key: "utilidad", label: "utilidad", pct: 23.2, color: "var(--accent-bright)" },
];

export const readingBlocks = [
  {
    id: "lede",
    title: null as string | null,
    prose:
      'La utilidad del semestre es <mono>50,000</mono> y en el banco hay <mono>3,000</mono>. Esa distancia no está en el margen del estado de resultados: el margen está sano. Está en tres renglones del balance.',
    figure: "47,000",
    caption: "Utilidad que no está en caja",
    derived: null as string | null,
  },
  {
    id: "cobros",
    title: "Cobros",
    prose:
      'Cuentas por cobrar cerró en <mono>10,000</mono>, una quinta parte de la utilidad del periodo. Contra una facturación de <mono>214,800</mono> en seis meses, son cerca de ocho días de venta parados en clientes que ya recibieron el trabajo.',
    figure: "10,000",
    caption: "Cuentas por cobrar",
    derived: "≈ 8 días de venta",
  },
  {
    id: "inventario",
    title: "Inventario",
    prose:
      'Materiales pesa <mono>18,400</mono>: el 30% de tus activos y más de un tercio de la utilidad. Es material comprado que todavía no le cobraste a nadie.',
    figure: "18,400",
    caption: "Inventario de materiales",
    derived: "30% de los activos",
  },
  {
    id: "exposicion",
    title: "Exposición",
    prose:
      'Entre préstamo bancario e impuestos por pagar debes <mono>16,800</mono> contra <mono>3,000</mono> en caja. Si un cliente grande se atrasa este mes, no tienes de dónde.',
    figure: "16,800",
    caption: "Deuda + impuestos",
    derived: "5.6× la caja disponible",
  },
];

export const chatMessages = [
  {
    id: "m1",
    role: "owner" as const,
    author: "Abraham",
    at: "09:12",
    text: "¿Puedo contratar un ayudante más este mes? Tengo dos obras en paralelo en agosto.",
  },
  {
    id: "m2",
    role: "advisor" as const,
    author: "Asesor Financiero",
    at: "09:12",
    paragraphs: [
      'Con las cifras de junio, todavía no. En banco hay <mono>3,000</mono> y debes <mono>16,800</mono> entre préstamo e impuestos. Un ayudante con cargas te cuesta cerca de <mono>950</mono> al mes, y el problema no es el monto: es que el salario se paga quincenal y tus clientes pagan a cuarenta días.',
      'Lo que cambiaría mi respuesta es cuánto de los <mono>10,000</mono> por cobrar entra antes del 15 de agosto.',
    ],
  },
  {
    id: "m3",
    role: "owner" as const,
    author: "Abraham",
    at: "09:18",
    text: "Vega dice que paga 4,200 el 15 de julio. Los otros dos no contestan.",
  },
  {
    id: "m4",
    role: "advisor" as const,
    author: "Asesor Financiero",
    at: "09:19",
    paragraphs: [
      'Entonces la pregunta no es si contratas: es si cobras. Con esos <mono>4,200</mono> quedas en <mono>7,200</mono> de caja contra <mono>16,800</mono> de obligaciones. Sigue apretado, pero deja de ser un no.',
    ],
    recommendation: {
      text: "Pedirle a Vega la fecha de pago por escrito y escalar los otros dos al correo de administración.",
      due: "vence vie 18 jul 2026",
    },
  },
];

export const commitmentsSeed: Commitment[] = [
  {
    id: "c1",
    text: "Llamar a los 3 clientes con facturas > 30 días antes del viernes.",
    dueLabel: "vencía vie 3 jul · hace 4 días",
    origin: "de la primera lectura · 30 jun",
    status: "overdue",
    thread: [
      {
        author: "Abraham",
        role: "owner",
        at: "5 jul 2026 · 16:20",
        text: "Hablé con Constructora Vega. Dicen que pagan la factura de 4,200 el 15 de julio, cuando les entre el desembolso del banco. Los otros dos no me contestan el teléfono.",
      },
      {
        author: "Asesor Financiero",
        role: "advisor",
        at: "5 jul 2026 · 16:24",
        text: "Vega te está financiando con tu dinero: doce días más sobre una factura ya vencida. Pídelo por escrito con fecha; si el 15 no entra, ese cliente pasa a prepago. A los otros dos deja de llamarlos al celular — escribe al correo de administración con la factura adjunta, necesitas rastro. ¿Muevo la fecha de este compromiso al 16 de julio?",
      },
    ],
  },
  {
    id: "c2",
    text: "Pedir a contabilidad el detalle de antigüedad de cuentas por cobrar.",
    dueLabel: "vence mar 14 jul",
    origin: "del chat con el Asesor Financiero · 1 jul",
    status: "pending",
  },
  {
    id: "c3",
    text: "Bajar inventario de materiales a 12,000 antes del cierre de agosto.",
    dueLabel: "vence vie 29 ago",
    origin: "de la primera lectura · 30 jun",
    status: "pending",
  },
  {
    id: "c4",
    text: "Abrir cuenta separada para impuestos retenidos.",
    dueLabel: "hecho 2 jul",
    origin: "del chat con el Asesor Financiero · 28 jun",
    status: "done",
    resolution: "Cuenta abierta el 2 jul; 2,300 transferidos el mismo día",
  },
  {
    id: "c5",
    text: "Revisar contrato de Eurohogar por cláusulas de pago.",
    dueLabel: "pospuesto a 21 jul",
    origin: "del chat con el Asesor Financiero · 25 jun",
    status: "postponed",
    resolution: "De 5 jul a 21 jul — esperando respuesta legal del cliente",
  },
  {
    id: "c6",
    text: "Congelar compras de inventario hasta cobrar Vega.",
    dueLabel: "descartado 3 jul",
    origin: "de la primera lectura · 30 jun",
    status: "discarded",
    resolution: "Hay pedidos ya comprometidos con proveedores; no se puede congelar sin romper plazos de obra",
  },
];

export function renderMonoHtml(text: string): string {
  return text.replace(/<mono>(.*?)<\/mono>/g, '<span class="mono">$1</span>');
}
