import { RULES_CONFIG } from './config'
import type { DassLevel, DassScale, DassScores } from './types'
import { DASS_LEVELS } from './types'

/** Ítems (numerados 1–21) de cada subescala del DASS-21. */
export const DASS_SCALE_ITEMS: Record<DassScale, readonly number[]> = {
  estres: [1, 6, 8, 11, 12, 14, 18],
  ansiedad: [2, 4, 7, 9, 15, 19, 20],
  depresion: [3, 5, 10, 13, 16, 17, 21],
}

/** Puntaje bruto WHO-5 (0–25). */
export function who5Total(items: readonly number[]): number {
  return items.reduce((acc, v) => acc + v, 0)
}

/** Equivalencia porcentual (0–100 %). */
export function who5Percent(total: number): number {
  return total * 4
}

export function dassScores(items: ReadonlyArray<number | null | undefined>): DassScores {
  const sum = (scale: DassScale) =>
    DASS_SCALE_ITEMS[scale].reduce((acc, n) => acc + (items[n - 1] ?? 0), 0)
  return {
    depresion: sum('depresion'),
    ansiedad: sum('ansiedad'),
    estres: sum('estres'),
    depresionIncompleta: DASS_SCALE_ITEMS.depresion.some((n) => items[n - 1] == null),
  }
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
