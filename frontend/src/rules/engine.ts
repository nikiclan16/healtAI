import { RULES_CONFIG } from './config'
import { dassLevel, dassScores, isAtLeast, who5Percent, who5Total } from './scoring'
import type { DassScale, RuleOutcome, RulesConfig, RulesInput, RulesResult } from './types'
import { DASS_SCALES } from './types'

export const SCALE_LABEL: Record<DassScale, string> = {
  depresion: 'Depresión',
  ansiedad: 'Ansiedad',
  estres: 'Estrés',
}

/**
 * Motor de reglas clínicas R1–R5 + regla de seguridad.
 * Función pura y determinística, independiente del clasificador (RF05.1).
 * Reemplazable por una llamada al motor_reglas.py del backend sin tocar las pantallas.
 */
export function evaluateRules(input: RulesInput, cfg: RulesConfig = RULES_CONFIG): RulesResult {
  const scores = dassScores(input.dassItems)
  const levels = {
    depresion: dassLevel('depresion', scores.depresion, cfg.dassCuts),
    ansiedad: dassLevel('ansiedad', scores.ansiedad, cfg.dassCuts),
    estres: dassLevel('estres', scores.estres, cfg.dassCuts),
  }
  const total = who5Total(input.who5Items)
  const pct = who5Percent(total)
  const item21 = input.dassItems[20] ?? null

  // R1 — ítem 21 DASS-21 ≥ 2 o no evaluable
  const r1 = item21 === null || item21 >= cfg.r1.item21Min
  const r1Detail =
    item21 === null
      ? 'Ítem 21 no evaluable: se trata como riesgo suicida'
      : `Ítem 21 = ${item21} (umbral ≥ ${cfg.r1.item21Min})`

  // R2 — alguna subescala severa o extremadamente severa
  const severe = DASS_SCALES.filter((s) => isAtLeast(levels[s], cfg.r2.minLevel))
  const r2Detail = severe.length
    ? severe.map((s) => `${SCALE_LABEL[s]} ${scores[s]} (${levels[s]})`).join(', ')
    : 'Ninguna subescala en nivel severo o superior'

  // R3 — WHO-5 ≤ 28 %
  const r3 = pct <= cfg.r3.who5MaxPercent
  const r3Detail = `WHO-5 = ${total}/25 (${pct} %), umbral ≤ ${cfg.r3.who5MaxPercent} %`

  // R4 — dos o más subescalas en nivel moderado o superior
  const moderate = DASS_SCALES.filter((s) => isAtLeast(levels[s], cfg.r4.minLevel))
  const r4 = moderate.length >= cfg.r4.minScales
  const r4Detail = `${moderate.length} subescala(s) en nivel ${cfg.r4.minLevel} o superior: ${
    moderate.map((s) => `${SCALE_LABEL[s]} ${scores[s]}`).join(', ') || 'ninguna'
  }`

  // R5 — ≥ 3 de 4 marcadores de vulnerabilidad
  const markers = [
    { label: `Sueño ≤ ${cfg.r5.sleepMax}`, hit: input.v15CalidadSueno <= cfg.r5.sleepMax },
    { label: `Apoyo familiar ≤ ${cfg.r5.supportMax}`, hit: input.v13ApoyoFamiliar <= cfg.r5.supportMax },
    {
      label: `Actividad física = ${cfg.r5.activityEquals}`,
      hit: input.v14ActividadFisica === cfg.r5.activityEquals,
    },
    { label: `WHO-5 < ${cfg.r5.who5BelowPercent} %`, hit: pct < cfg.r5.who5BelowPercent },
  ]
  const hits = markers.filter((m) => m.hit)
  const r5 = hits.length >= cfg.r5.minMarkers
  const r5Detail = `${hits.length} de ${markers.length} marcadores: ${hits.map((m) => m.label).join(', ') || 'ninguno'}`

  // Regla de seguridad — reporte del profesional
  const flags = input.alertasProfesional
  const segLabels = [
    flags.riesgo_suicida && 'riesgo suicida',
    flags.deterioro_agudo && 'deterioro clínico agudo',
    flags.riesgo_urgente && 'riesgo clínico urgente',
  ].filter((x): x is string => Boolean(x))
  const seg = segLabels.length > 0

  const outcomes: RuleOutcome[] = [
    { code: 'R1', name: 'Alerta de riesgo suicida (ítem 21 DASS-21)', triggered: r1, detail: r1Detail },
    { code: 'R2', name: 'Subescala DASS-21 severa o extremadamente severa', triggered: severe.length > 0, detail: r2Detail },
    { code: 'R3', name: 'Bienestar WHO-5 ≤ 28 % (probable depresión)', triggered: r3, detail: r3Detail },
    { code: 'R4', name: 'Co-ocurrencia de malestar (≥ 2 subescalas moderadas)', triggered: r4, detail: r4Detail },
    { code: 'R5', name: 'Marcadores de vulnerabilidad (≥ 3 de 4)', triggered: r5, detail: r5Detail },
    {
      code: 'SEG',
      name: 'Regla de seguridad (reporte del profesional)',
      triggered: seg,
      detail: seg ? `Reportado: ${segLabels.join(', ')}` : 'Sin alertas reportadas por el profesional',
    },
  ]
  const triggered = outcomes.filter((o) => o.triggered)

  return {
    outcomes,
    triggered,
    escalates: triggered.length > 0,
    locked: seg,
    suicideAlert: r1,
    scores,
    levels,
    who5Total: total,
    who5Percent: pct,
  }
}

/** Ruta final sugerida por el sistema: cualquier regla disparada fuerza Ruta A. */
export function resolveRoute(
  base: 'A' | 'B',
  rules: Pick<RulesResult, 'escalates'>,
): { finalRoute: 'A' | 'B'; escalated: boolean } {
  if (rules.escalates) return { finalRoute: 'A', escalated: base === 'B' }
  return { finalRoute: base, escalated: false }
}
