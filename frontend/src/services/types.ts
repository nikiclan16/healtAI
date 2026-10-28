import type { RulesResult } from '@/rules'
import type { ScreeningForm } from './contract'

export type SiteCode = 'BAQ' | 'RHA' | 'VUP'
/** Perfil de acceso (RBAC) — lo decide el servidor. */
export type Role = 'evaluador' | 'investigador'
/** Código del rol operativo que el usuario declara en el portal de acceso; el servidor lo valida.
 *  Los roles los crea el administrador, por eso es un texto libre y no una lista fija. */
export type Cargo = string
export type RouteCode = 'A' | 'B'
export type Confidence = 'Alta' | 'Media' | 'Baja'

export interface UserProfile {
  id: string
  nombre: string
  /** Perfil RBAC confirmado por el servidor. */
  rol: Role
  /** Rol operativo con el que se ingresó. */
  cargo: Cargo
  /** Nombre legible del rol operativo. */
  cargoLabel?: string
}

export interface Session {
  token: string
  /** Epoch en ms. */
  expiresAt: number
  user: UserProfile
  sede: SiteCode
  /** La contraseña es temporal (fijada por un administrador): debe cambiarse antes de operar. */
  debeCambiarPassword?: boolean
}

export interface LoginCredentials {
  usuario: string
  password: string
  cargo: Cargo
  sede: SiteCode
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
  /** `null` mientras los modelos retadores (KNN, MLP) no estén conectados. */
  confianza: Confidence | null
  retadores: { knn: number; mlp: number; consenso: number } | null
  shapTop3: ShapFactor[]
  versionModelo: string
  /** true si el servidor usa el modelo de prueba (valores de ejemplo, NO clínico). */
  modeloPlaceholder?: boolean
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
  /** Variables que usó el modelo (nombre → valor). */
  entrada: Record<string, number>
  prediccion: PredictResponse
  reglas: RulesResult
  /** Ruta tras aplicar las reglas (lo que el sistema sugiere). */
  rutaSistema: RouteCode
  escalada: boolean
  versiones: { app: string; modelo: string; diccionario: string }
  decision?: Decision
}


/** Una fila del procesamiento por lotes (RF03.2). */
export interface BatchRow {
  /** Número de fila en el archivo (la cabecera es la 1). */
  fila: number
  ok: boolean
  error?: string
  probabilidadRA?: number
  rutaBase?: RouteCode
  rutaSistema?: RouteCode
  escalada?: boolean
  reglas?: string[]
  shapTop3?: ShapFactor[]
}

export interface BatchResult {
  archivo: string
  /** Huella SHA-256 del archivo recibido (integridad). */
  sha256: string
  columnas: string[]
  resumen: {
    filas: number
    procesadas: number
    conError: number
    baseRA: number
    baseRB: number
    escaladas: number
    finalA: number
    finalB: number
  }
  versiones: { app: string; modelo: string; diccionario: string }
  modeloPlaceholder: boolean
  resultados: BatchRow[]
}

export interface SiteMetrics {
  sede: SiteCode
  nombre: string
  evaluaciones: number
  rutaA: number
  escaladas: number
  decisiones: number
  /** Proporción de decisiones que coinciden con la ruta del sistema; null sin decisiones. */
  concordancia: number | null
}

/** Métricas agregadas del panel del investigador (GET /investigador/metricas). */
export interface InvestigatorMetrics {
  totales: {
    evaluaciones: number
    decisiones: number
    pendientes: number
    rutaA: number
    escaladas: number
    concordancia: number | null
  }
  sedes: SiteMetrics[]
  acciones: Partial<Record<DecisionAction, number>>
  reglas: Record<string, number>
  conceptDrift: { ventana: number; decisiones: number; concordancia: number | null }
  dataDrift: { disponible: boolean; motivo?: string }
  auditoria: { eventos: number; integra: boolean; primerRegistroAlterado: number | null }
}

/** Archivo descargado de la API. */
export interface DownloadedFile {
  blob: Blob
  filename: string
}
