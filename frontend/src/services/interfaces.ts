import type { ModelInput } from './contract'
import type {
  Decision,
  Evaluation,
  HealthStatus,
  LoginCredentials,
  NewEvaluation,
  PredictMeta,
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
}

export interface ModelService {
  /** POST /predecir */
  predict(input: ModelInput, meta: PredictMeta): Promise<PredictResponse>
  /** GET /salud */
  health(): Promise<HealthStatus>
}

export interface EvaluationService {
  create(evaluation: NewEvaluation): Promise<Evaluation>
  get(id: string): Promise<Evaluation | null>
  list(): Promise<Evaluation[]>
  recordDecision(id: string, decision: Decision): Promise<Evaluation>
}

export interface Services {
  auth: AuthService
  model: ModelService
  evaluations: EvaluationService
}
