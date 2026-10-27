import type { RouteCode } from '@/services/types'

/** RF05.2 — acciones diferenciadas por ruta. */
export const ROUTE_ACTIONS: Record<RouteCode, { title: string; items: string[] }> = {
  A: {
    title: 'Ruta A — atención prioritaria en salud mental',
    items: [
      'Notificación prioritaria para valoración psicológica/psiquiátrica',
      'Abordaje de la ansiedad anticipatoria frente a la amputación',
      'Soporte en duelo por pérdida corporal',
      'Evaluación de alteración de la imagen corporal',
      'Higiene del sueño',
      'Fortalecimiento de redes de apoyo',
    ],
  },
  B: {
    title: 'Ruta B — seguimiento en atención primaria',
    items: [
      'Protocolo de psicoeducación',
      'Promoción de hábitos saludables',
      'Refuerzo de la adherencia al tratamiento',
      'Programar revaloración periódica del bienestar',
    ],
  },
}
