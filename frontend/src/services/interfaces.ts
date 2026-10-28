import type { ScreeningForm } from './contract'
import type {
  BatchResult,
  Decision,
  DownloadedFile,
  Evaluation,
  HealthStatus,
  InvestigatorMetrics,
  LoginCredentials,
  PredictResponse,
  Session,
} from './types'

/** Errores de la API. */
export class ApiError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** HTTP 422: el backend rechazó un valor fuera del contrato (RF02.3). */
export class ApiValidationError extends ApiError {
  fields: { campo: string; mensaje: string }[]
  constructor(fields: { campo: string; mensaje: string }[]) {
    super('Hay valores fuera del contrato de datos', 422)
    this.name = 'ApiValidationError'
    this.fields = fields
  }
}

export interface CargoOption {
  code: string
  label: string
}

export interface AuthService {
  /** Roles operativos activos para el selector del portal de acceso. */
  listCargos(): Promise<CargoOption[]>
  login(credentials: LoginCredentials): Promise<Session>
  logout(): Promise<void>
  /** El propio usuario cambia su contraseña (obligatorio si la actual es temporal). */
  changePassword(actual: string, nueva: string): Promise<void>
}

export interface ModelService {
  /** GET /salud */
  health(): Promise<HealthStatus>
  /** POST /predecir (RF03.1): inferencia pura, sin reglas ni registro. */
  predict(form: ScreeningForm): Promise<PredictResponse>
}

export interface EvaluationService {
  /**
   * Ejecuta el tamizaje completo: inferencia + motor de reglas + registro (POST /evaluaciones).
   * El servidor calcula la predicción, las reglas y la ruta; el cliente solo envía las respuestas.
   */
  submit(form: ScreeningForm): Promise<Evaluation>
  get(id: string): Promise<Evaluation | null>
  list(): Promise<Evaluation[]>
  recordDecision(id: string, decision: Decision): Promise<Evaluation>
}

/** Procesamiento por lotes (RF03.2). Requiere el backend: no tiene modo simulado. */
export interface BatchService {
  /** POST /lotes con un archivo CSV/XLSX. */
  upload(file: File): Promise<BatchResult>
  /** Plantilla CSV con las columnas del diccionario. */
  template(): Promise<DownloadedFile>
}

/** Panel del investigador (solo lectura). Requiere el backend: no tiene modo simulado. */
export interface InvestigatorService {
  metrics(): Promise<InvestigatorMetrics>
  exportEvaluations(): Promise<DownloadedFile>
  exportAudit(): Promise<DownloadedFile>
}

export interface Services {
  auth: AuthService
  model: ModelService
  evaluations: EvaluationService
  batch: BatchService
  investigator: InvestigatorService
}
