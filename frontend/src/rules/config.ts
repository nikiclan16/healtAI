import type { RulesConfig } from './types'

/**
 * Umbrales del motor de reglas (RNF04.3: ajustables sin tocar la lógica).
 * PENDIENTE: validación del referente clínico antes de cualquier uso con profesionales.
 *
 * Cortes DASS-21 sobre el puntaje bruto de cada subescala (0–21).
 */
export const RULES_CONFIG: RulesConfig = {
  dassCuts: {
    depresion: [4, 6, 10, 13],
    ansiedad: [3, 5, 7, 9],
    estres: [7, 9, 12, 16],
  },
  r1: { item21Min: 2 },
  r2: { minLevel: 'severo' },
  r3: { who5MaxPercent: 28 },
  r4: { minLevel: 'moderado', minScales: 2 },
  r5: {
    minMarkers: 3,
    sleepMax: 2,
    supportMax: 2,
    activityEquals: 0,
    who5BelowPercent: 52,
  },
}
