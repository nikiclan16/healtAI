import { RULES_CONFIG } from './config'
import type { DassLevel, DassScale } from './types'
import { DASS_LEVELS } from './types'

/** Equivalencia porcentual del WHO-5 (0–100 %) a partir del puntaje bruto (0–25). */
export function who5Percent(total: number): number {
  return total * 4
}

export function dassLevel(
  scale: DassScale,
  score: number,
  cuts: typeof RULES_CONFIG.dassCuts = RULES_CONFIG.dassCuts,
): DassLevel {
  const idx = cuts[scale].findIndex((limit) => score <= limit)
  return DASS_LEVELS[idx === -1 ? DASS_LEVELS.length - 1 : idx]
}

export function isAtLeast(level: DassLevel, min: DassLevel): boolean {
  return DASS_LEVELS.indexOf(level) >= DASS_LEVELS.indexOf(min)
}
