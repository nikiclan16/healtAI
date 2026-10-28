import type { RouteCode } from '@/services/types'

/** RF05.2 — acciones diferenciadas por ruta. */
export const ROUTE_ACTIONS: Record<RouteCode, { title: string; items: string[] }> = {
  A: {
    title: 'Paquete de Acciones Inmediatas para Ruta A:',
    items: [
      'Valoración prioritaria por psicología clínica',
      'Abordaje de ansiedad anticipatoria a amputación',
      'Intervención en duelo por pérdida corporal e imagen',
      'Higiene del sueño y seguimiento a la adherencia',
      'Fortalecimiento de redes de apoyo',
    ],
  },
  B: {
    title: 'Paquete de Acciones para Ruta B:',
    items: [
      'Protocolo de psicoeducación',
      'Promoción de hábitos saludables',
      'Refuerzo de la adherencia al tratamiento',
      'Programar revaloración periódica del bienestar',
    ],
  },
}
