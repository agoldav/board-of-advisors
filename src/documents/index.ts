/** Public surface for document ingestion (Task 4). */
export {
  ingestFinancialPdf,
  getConfirmationView,
  correctFigures,
  confirmDocument,
  rejectDocument,
  getConfirmedFiguresForAdvice,
  OutOfCreditsError,
  DocumentNotFoundError,
  InvalidDocumentStateError,
} from "./service.js";
export {
  validateFigures,
  assertReadyForAdvice,
  UnbalancedFiguresError,
} from "./validate.js";
export {
  parseExtractionToolInput,
  NotFinancialStatementError,
  EmptyExtractionError,
} from "./extraction.js";
export type { ConfirmationView, ArithmeticValidation, ExtractedFigureRow } from "./types.js";
