import type { ScreeningForm } from '../contract'

/**
 * "Caso Anexo E" del prototipo: 10 años de DM2, orales, hipertensión, sueño malo,
 * WHO-5 = 8/25 (32 %), DASS-21 Dep 9 · Ans 8 · Est 12, ítem 21 = 1, ADA nivel 3.
 * Resultado esperado de reglas: R2, R4 y R5 → Ruta A.
 */
export const ANEXO_E: ScreeningForm = {
  codigo_paciente: 'PAC-2026-0048',
  v8_tiempo_diagnostico: 10,
  v9: { dieta_ejercicio: 0, orales: 1, insulina: 0, orales_insulina: 0, ninguno: 0 },
  v11: { ninguna: 0, hipertension: 1, cardiaca: 0, obesidad: 0, otra: 0 },
  v12_percepcion_salud: 3,
  v13_apoyo_familiar: 4,
  v14_actividad_fisica: 0,
  v15_calidad_sueno: 2,
  who5_items: [2, 1, 2, 1, 2],
  // Ítems 1–21. Estrés (1,6,8,11,12,14,18)=12 · Ansiedad (2,4,7,9,15,19,20)=8 · Depresión (3,5,10,13,16,17,21)=9
  dass21_items: [2, 1, 2, 1, 1, 2, 1, 2, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1],
  nivel_riesgo_amputacion: 3,
  alertas_profesional: { riesgo_suicida: false, deterioro_agudo: false, riesgo_urgente: false },
}
