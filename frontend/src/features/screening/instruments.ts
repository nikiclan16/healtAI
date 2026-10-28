import type { Treatment } from '@/services/contract'

/** Opciones de los selectores del formulario (textos del mockup RF02). */

export const TREATMENT_OPTIONS: { value: Treatment; label: string }[] = [
  { value: 'dieta_ejercicio', label: 'Dieta y Ejercicio Únicamente' },
  { value: 'orales', label: 'Hipoglucemiantes Orales' },
  { value: 'insulina', label: 'Insulina' },
  { value: 'orales_insulina', label: 'Orales + Insulina Combinados' },
  { value: 'ninguno', label: 'Sin Tratamiento Activo' },
]

export const HEALTH_PERCEPTION = [
  { value: 1, label: '1 - Muy Mala' },
  { value: 2, label: '2 - Mala' },
  { value: 3, label: '3 - Regular / Aceptable' },
  { value: 4, label: '4 - Buena' },
  { value: 5, label: '5 - Muy Buena' },
]

export const PHYSICAL_ACTIVITY = [
  { value: 0, label: '0 - Sedentario (Ningún día/semana)' },
  { value: 1, label: '1 - Ocasional (1-2 días/semana)' },
  { value: 2, label: '2 - Regular (3-4 días/semana)' },
  { value: 3, label: '3 - Activo (5-7 días/semana)' },
]

export const SLEEP_QUALITY = [
  { value: 1, label: '1 - Muy Mala (Insomnio severo)' },
  { value: 2, label: '2 - Mala / Interrumpido' },
  { value: 3, label: '3 - Regular' },
  { value: 4, label: '4 - Buena' },
  { value: 5, label: '5 - Muy Buena / Reparador' },
]

export const FAMILY_SUPPORT = [
  { value: 1, label: '1 - Nulo / Aislado' },
  { value: 2, label: '2 - Bajo' },
  { value: 3, label: '3 - Moderado' },
  { value: 4, label: '4 - Alto' },
  { value: 5, label: '5 - Muy Alto / Sólido' },
]

/** Ítem 21 del DASS-21. "no_evaluable" se guarda como `null` y activa R1. */
export const ITEM21_OPTIONS = [
  { value: '0', label: '0 - No me aplicó en absoluto' },
  { value: '1', label: '1 - Me aplicó en algún grado' },
  { value: '2', label: '2 - Me aplicó en grado considerable (Trigger R1)' },
  { value: '3', label: '3 - Me aplicó mucho o la mayor parte (Trigger R1)' },
  { value: 'ne', label: 'No evaluable (Trigger R1)' },
]
