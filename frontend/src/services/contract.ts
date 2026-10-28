import { z } from 'zod'

/**
 * Contrato de datos del formulario (RF02). Es la única fuente de validación de rangos.
 * Los rangos vienen de la especificación; los nombres de campo del formulario son internos.
 */

const intRange = (min: number, max: number) =>
  z
    .number({ error: 'Requerido' })
    .int('Debe ser un número entero')
    .min(min, `Mínimo ${min}`)
    .max(max, `Máximo ${max}`)

export const TREATMENTS = ['dieta_ejercicio', 'orales', 'insulina', 'orales_insulina', 'ninguno'] as const
export type Treatment = (typeof TREATMENTS)[number]

export const ScreeningSchema = z.object({
  // El código seudonimizado del paciente NO se captura: lo genera el sistema al guardar (RNF01.2).
  v8_tiempo_diagnostico: intRange(0, 80),
  v9_tratamiento: z.enum(TREATMENTS, { error: 'Seleccione una opción' }),
  /** Comorbilidades marcadas. "Ninguna" se deriva cuando no hay ninguna marcada. */
  v11: z.object({
    hipertension: z.boolean(),
    cardiaca: z.boolean(),
    obesidad: z.boolean(),
    otra: z.boolean(),
  }),
  v12_percepcion_salud: intRange(1, 5),
  v13_apoyo_familiar: intRange(1, 5),
  v14_actividad_fisica: intRange(0, 3),
  v15_calidad_sueno: intRange(1, 5),

  /** Puntaje bruto WHO-5 (0–25); el porcentaje se calcula como ×4. */
  who5_total: intRange(0, 25),
  /** Subescalas DASS-21, puntaje bruto 0–21. */
  dass_depresion: intRange(0, 21),
  dass_ansiedad: intRange(0, 21),
  dass_estres: intRange(0, 21),
  /** Ítem 21 del DASS-21 (0–3). `null` = no evaluable (activa R1). */
  dass_item21: intRange(0, 3).nullable(),

  /**
   * Escala ADA/IWGDF. NUNCA se envía al modelo (RF02.4): solo uso clínico y reglas.
   */
  nivel_riesgo_amputacion: intRange(1, 4),

  /** Insumo de la regla de seguridad (RF05.1). */
  alertas_profesional: z.object({
    riesgo_suicida: z.boolean(),
    deterioro_agudo: z.boolean(),
    riesgo_urgente: z.boolean(),
  }),
})

export type ScreeningForm = z.infer<typeof ScreeningSchema>

/**
 * Entrada del modelo S2 (15 variables: V8, V9×5, V11×5, V12, V14, V15, WHO-5 total).
 * PROVISIONAL: nombres y forma a confirmar con el contrato real de POST /predecir.
 * V13, DASS-21 y Nivel_de_Riesgo NO forman parte de la entrada del clasificador.
 */
export interface ModelInput {
  V8_TiempoDiagnosticoDM2: number
  V9_Trat_DietaEjercicio: 0 | 1
  V9_Trat_Orales: 0 | 1
  V9_Trat_Insulina: 0 | 1
  V9_Trat_OralesInsulina: 0 | 1
  V9_Trat_Ninguno: 0 | 1
  V11_Enf_Ninguna: 0 | 1
  V11_Enf_Hipertension: 0 | 1
  V11_Enf_Cardiaca: 0 | 1
  V11_Enf_Obesidad: 0 | 1
  V11_Enf_Otra: 0 | 1
  V12_PercepcionSalud: number
  V14_ActividadFisica: number
  V15_CalidadSueno: number
  WHO5_Total: number
}

const bit = (x: boolean): 0 | 1 => (x ? 1 : 0)

/** Único punto donde el formulario se traduce a la entrada del modelo. */
export function buildModelInput(f: ScreeningForm): ModelInput {
  const t = f.v9_tratamiento
  const anyDisease = f.v11.hipertension || f.v11.cardiaca || f.v11.obesidad || f.v11.otra
  return {
    V8_TiempoDiagnosticoDM2: f.v8_tiempo_diagnostico,
    V9_Trat_DietaEjercicio: bit(t === 'dieta_ejercicio'),
    V9_Trat_Orales: bit(t === 'orales'),
    V9_Trat_Insulina: bit(t === 'insulina'),
    V9_Trat_OralesInsulina: bit(t === 'orales_insulina'),
    V9_Trat_Ninguno: bit(t === 'ninguno'),
    V11_Enf_Ninguna: bit(!anyDisease),
    V11_Enf_Hipertension: bit(f.v11.hipertension),
    V11_Enf_Cardiaca: bit(f.v11.cardiaca),
    V11_Enf_Obesidad: bit(f.v11.obesidad),
    V11_Enf_Otra: bit(f.v11.otra),
    V12_PercepcionSalud: f.v12_percepcion_salud,
    V14_ActividadFisica: f.v14_actividad_fisica,
    V15_CalidadSueno: f.v15_calidad_sueno,
    WHO5_Total: f.who5_total,
  }
}
