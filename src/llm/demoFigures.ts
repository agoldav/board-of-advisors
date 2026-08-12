/**
 * Balanced Siscon-style figures for the no-Claude golden path.
 * Matches the web fixtures arithmetic (assets = liabilities + equity).
 */
import type { Figure } from "../advisors/reconciliation.js";

/** Current period figures used by mock extraction / demo seed. */
export const DEMO_CURRENT_FIGURES: Figure[] = [
  { lineItem: "Efectivo en bancos", value: 3000, statementSection: "assets" },
  { lineItem: "Cuentas por cobrar", value: 10000, statementSection: "assets" },
  { lineItem: "Inventario de materiales", value: 18400, statementSection: "assets" },
  { lineItem: "Equipo y herramientas", value: 42000, statementSection: "assets" },
  { lineItem: "Depreciación acumulada", value: -11200, statementSection: "assets" },
  { lineItem: "Cuentas por pagar", value: 9800, statementSection: "liabilities" },
  { lineItem: "Préstamo bancario", value: 14500, statementSection: "liabilities" },
  { lineItem: "Impuestos por pagar", value: 2300, statementSection: "liabilities" },
  { lineItem: "Capital social", value: 5000, statementSection: "equity" },
  { lineItem: "Utilidades retenidas", value: 30600, statementSection: "equity" },
  { lineItem: "Ingresos por servicios", value: 214800, statementSection: "revenue" },
  { lineItem: "Costo de ventas", value: 131500, statementSection: "expense" },
  { lineItem: "Gastos operativos", value: 28900, statementSection: "expense" },
  { lineItem: "Depreciación del periodo", value: 3200, statementSection: "expense" },
  { lineItem: "Gastos financieros", value: 1200, statementSection: "expense" },
];

export const DEMO_PERIOD_START = "2026-01-01";
export const DEMO_PERIOD_END = "2026-06-30";

/** Prior period (lighter cash / lower AR) so first-read facts show a divergence. */
export const DEMO_PREVIOUS_FIGURES: Figure[] = [
  { lineItem: "Efectivo en bancos", value: 8500, statementSection: "assets" },
  { lineItem: "Cuentas por cobrar", value: 6200, statementSection: "assets" },
  { lineItem: "Inventario de materiales", value: 14200, statementSection: "assets" },
  { lineItem: "Equipo y herramientas", value: 42000, statementSection: "assets" },
  { lineItem: "Depreciación acumulada", value: -8000, statementSection: "assets" },
  { lineItem: "Cuentas por pagar", value: 7200, statementSection: "liabilities" },
  { lineItem: "Préstamo bancario", value: 16000, statementSection: "liabilities" },
  { lineItem: "Impuestos por pagar", value: 1800, statementSection: "liabilities" },
  { lineItem: "Capital social", value: 5000, statementSection: "equity" },
  // assets 62,900 = liabilities 25,000 + equity 37,900
  { lineItem: "Utilidades retenidas", value: 32900, statementSection: "equity" },
];

export const DEMO_FIRST_READING = `La utilidad del semestre es 50,000 y en el banco hay 3,000. Esa distancia no está en el margen del estado de resultados: el margen está sano. Está en tres renglones del balance.

## Cobros
Cuentas por cobrar cerró en 10,000, una quinta parte de la utilidad del periodo. Contra una facturación de 214,800 en seis meses, son cerca de ocho días de venta parados en clientes que ya recibieron el trabajo.

## Inventario
Materiales pesa 18,400: el 30% de tus activos y más de un tercio de la utilidad. Es material comprado que todavía no le cobraste a nadie.

## Exposición
Entre préstamo bancario e impuestos por pagar debes 16,800 contra 3,000 en caja. Si un cliente grande se atrasa este mes, no tienes de dónde.

## Lo que necesito saber
¿Cuántos de los 10,000 por cobrar tienen más de 30 días, y de qué clientes? Sin ese dato no puedo decirte si es un problema de cobranza o de cómo estás firmando los contratos.

## Recomendación
Llamar a los 3 clientes con facturas > 30 días antes del viernes.`;

export const DEMO_COMMITMENT_TEXT =
  "Llamar a los 3 clientes con facturas > 30 días antes del viernes.";

/** Default due date for the first tracked commitment (demo — keep in the future). */
export const DEMO_COMMITMENT_DUE = "2026-08-21";
