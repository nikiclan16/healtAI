import type { ScreeningForm } from '../contract'

/**
 * "Caso Anexo E" del prototipo: 10 años de DM2, orales, hipertensión, sueño malo,
 * WHO-5 = 8/25 (32 %), DASS-21 Dep 9 · Ans 8 · Est 12, ítem 21 = 1, ADA nivel 3.
 * Resultado esperado de reglas: R2, R4 y R5 → Ruta A.
 */
export const ANEXO_E: ScreeningForm = {
  v8_tiempo_diagnostico: 10,
  v9_tratamiento: 'orales',
  v11: { hipertension: true, cardiaca: false, obesidad: false, otra: false },
  v12_percepcion_salud: 3,
  v13_apoyo_familiar: 4,
  v14_actividad_fisica: 0,
  v15_calidad_sueno: 2,
  who5_total: 8,
  dass_depresion: 9,
  dass_ansiedad: 8,
  dass_estres: 12,
  dass_item21: 1,
  alertas_profesional: { riesgo_suicida: false, deterioro_agudo: false, riesgo_urgente: false },
}
