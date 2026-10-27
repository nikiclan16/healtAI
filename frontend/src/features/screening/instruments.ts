import { DASS_SCALE_ITEMS } from '@/rules/scoring'
import type { DassScale } from '@/rules'

export const HEALTH_5 = [
  { value: 1, label: 'Muy mala' },
  { value: 2, label: 'Mala' },
  { value: 3, label: 'Regular' },
  { value: 4, label: 'Buena' },
  { value: 5, label: 'Muy buena' },
]

export const SUPPORT_5 = [
  { value: 1, label: 'Nulo / aislado' },
  { value: 2, label: 'Bajo' },
  { value: 3, label: 'Moderado' },
  { value: 4, label: 'Alto' },
  { value: 5, label: 'Muy alto' },
]

export const ACTIVITY_4 = [
  { value: 0, label: 'Ninguno' },
  { value: 1, label: '1 a 2 días/sem' },
  { value: 2, label: '3 a 4 días/sem' },
  { value: 3, label: '5 a 7 días/sem' },
]

export const ADA_4 = [1, 2, 3, 4].map((n) => ({ value: n, label: `Nivel ${n}` }))

/**
 * Textos de los instrumentos.
 * WHO-5: versión en español de la OMS. DASS-21: PENDIENTE cargar el texto validado
 * que use el estudio (ver docs/); mientras tanto se muestra "Ítem N" + subescala.
 */
export const WHO5_ITEMS = [
  'Me he sentido alegre y de buen humor',
  'Me he sentido tranquilo/a y relajado/a',
  'Me he sentido activo/a y enérgico/a',
  'Me he despertado sintiéndome fresco/a y descansado/a',
  'Mi vida diaria ha estado llena de cosas que me interesan',
]

export const WHO5_OPTIONS = [
  { value: 5, label: 'Todo el tiempo' },
  { value: 4, label: 'La mayor parte' },
  { value: 3, label: 'Más de la mitad' },
  { value: 2, label: 'Menos de la mitad' },
  { value: 1, label: 'De vez en cuando' },
  { value: 0, label: 'Nunca' },
]

export const DASS_OPTIONS = [
  { value: 0, label: 'No me ha ocurrido' },
  { value: 1, label: 'Un poco / parte del tiempo' },
  { value: 2, label: 'Bastante / buena parte del tiempo' },
  { value: 3, label: 'Mucho / la mayor parte del tiempo' },
]

/** Subescala de cada ítem (1–21). */
export const DASS_ITEM_SCALE: Record<number, DassScale> = Object.fromEntries(
  (Object.entries(DASS_SCALE_ITEMS) as [DassScale, readonly number[]][]).flatMap(([scale, items]) =>
    items.map((n) => [n, scale] as const),
  ),
)

export const DASS_ITEM_TEXT = (n: number) => `Ítem ${n}` // TODO: texto validado del DASS-21
