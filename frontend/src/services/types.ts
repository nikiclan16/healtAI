import type { RulesResult } from '@/rules'
import type { ModelInput, ScreeningForm } from './contract'

export type SiteCode = 'BAQ' | 'RHA' | 'VUP'
/** Perfil de acceso (RBAC) — lo decide el servidor. */
export type Role = 'evaluador' | 'investigador'
/** Rol operativo que el usuario declara en el portal de acceso; el servidor lo valida. */
export type Cargo = 'medico' | 'psicologo' | 'enfermeria' | 'investigador'
export type RouteCode = 'A' | 'B'
export type Confidence = 'Alta' | 'Media' | 'Baja'

export interface UserProfile {
  id: string
  nombre: string
  /** Perfil RBAC confirmado por el servidor. */
  rol: Role
  /** Rol operativo con el que se ingresó. */
  cargo: Cargo
}

export interface Session {
  token: string
  /** Epoch en ms. */
  expiresAt: number
  user: UserProfile
  sede: SiteCode
}

export interface LoginCredentials {
  usuario: string
  password: string
  cargo: Cargo
  sede: SiteCode
}

export interface PredictMeta {
  sede: SiteCode
  profesionalId: string
}

export interface ShapFactor {
  variable: string
  etiqueta: string
  /** Contribución firmada: > 0 empuja hacia Ruta A. */
  valor: number
  direccion: 'riesgo' | 'protector'
  descripcion: string
}

/**
 * Respuesta normalizada de POST /predecir.
 * PROVISIONAL: se ajusta en un solo lugar (services/http/model.ts) cuando exista el contrato real.
 */
export interface PredictResponse {
  probabilidadRA: number
  rutaBase: RouteCode
  confianza: Confidence
  retadores: { knn: number; mlp: number; consenso: number } | null
  shapTop3: ShapFactor[]
  versionModelo: string
}

export interface HealthStatus {
  ok: boolean
  versionModelo?: string
  detalle?: string
}

export type DecisionAction = 'confirmar' | 'rechazar' | 'ajustar'

/** Decisión humana final (RF06): etiqueta de referencia para auditoría de drift. */
export interface Decision {
  accion: DecisionAction
  rutaFinal: RouteCode
  justificacion: string
  profesionalId: string
  decididoEn: string
}

export interface Evaluation {
  id: string
  creadoEn: string
  /** Código seudonimizado generado por el sistema (p. ej. PAC-2026-0048). */
  codigoPaciente: string
  sede: SiteCode
  profesional: { id: string; nombre: string }
  formulario: ScreeningForm
  entrada: ModelInput
  prediccion: PredictResponse
  reglas: RulesResult
  /** Ruta tras aplicar las reglas (lo que el sistema sugiere). */
  rutaSistema: RouteCode
  escalada: boolean
  versiones: { app: string; modelo: string; diccionario: string }
  decision?: Decision
}

export type NewEvaluation = Omit<Evaluation, 'id' | 'creadoEn' | 'codigoPaciente' | 'decision'>
