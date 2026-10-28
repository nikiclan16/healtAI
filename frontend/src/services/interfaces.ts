import type { ScreeningForm } from './contract'
import type { Decision, Evaluation, HealthStatus, LoginCredentials, Session } from './types'

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
}

export interface ModelService {
  /** GET /salud */
  health(): Promise<HealthStatus>
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

export interface Services {
  auth: AuthService
  model: ModelService
  evaluations: EvaluationService
}
