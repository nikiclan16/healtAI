export type DassScale = 'depresion' | 'ansiedad' | 'estres'
export const DASS_SCALES: readonly DassScale[] = ['depresion', 'ansiedad', 'estres']

export type DassLevel = 'normal' | 'leve' | 'moderado' | 'severo' | 'extremo'
/** Orden ascendente de gravedad. */
export const DASS_LEVELS: readonly DassLevel[] = ['normal', 'leve', 'moderado', 'severo', 'extremo']

export type RuleCode = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'SEG'

export interface RulesConfig {
  /** Límites superiores (inclusive) de normal, leve, moderado y severo; por encima es extremo. */
  dassCuts: Record<DassScale, readonly [number, number, number, number]>
  r1: { item21Min: number }
  r2: { minLevel: DassLevel }
  r3: { who5MaxPercent: number }
  r4: { minLevel: DassLevel; minScales: number }
  r5: {
    minMarkers: number
    sleepMax: number
    supportMax: number
    activityEquals: number
    who5BelowPercent: number
  }
}

export interface AlertasProfesional {
  riesgo_suicida: boolean
  deterioro_agudo: boolean
  riesgo_urgente: boolean
}

/** Puntaje bruto de cada subescala del DASS-21 (0–21). */
export type DassScores = Record<DassScale, number>

export interface RulesInput {
  /** Puntaje bruto WHO-5 (0–25). */
  who5Total: number
  dass: DassScores
  /** Ítem 21 del DASS-21 (0–3). `null` = no evaluable. */
  item21: number | null
  v13ApoyoFamiliar: number
  v14ActividadFisica: number
  v15CalidadSueno: number
  alertasProfesional: AlertasProfesional
}

export interface RuleOutcome {
  code: RuleCode
  name: string
  triggered: boolean
  detail: string
}

export interface RulesResult {
  outcomes: RuleOutcome[]
  triggered: RuleOutcome[]
  /** Alguna regla exige Ruta A. */
  escalates: boolean
  /** Regla de seguridad activa: la ruta A no se puede degradar desde el software. */
  locked: boolean
  /** R1: alerta de riesgo suicida. */
  suicideAlert: boolean
  scores: DassScores
  levels: Record<DassScale, DassLevel>
  who5Total: number
  who5Percent: number
}
