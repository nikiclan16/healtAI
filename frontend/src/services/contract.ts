import { z } from 'zod'
import { who5Total } from '@/rules/scoring'

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

const binary = z.union([z.literal(0), z.literal(1)], { error: 'Requerido' })

/**
 * Casillas binarias independientes (0/1) con una opción excluyente ("Ninguno/Ninguna").
 * La regla vive en el objeto anidado para que se evalúe paso a paso en el formulario.
 */
function exclusiveGroup<S extends z.ZodType<Record<string, 0 | 1>>>(schema: S, none: string, label: string) {
  return schema.superRefine((group, ctx) => {
    const selected = Object.values(group).filter((x) => x === 1).length
    if (selected === 0) {
      ctx.addIssue({ code: 'custom', path: [none], message: `Seleccione al menos una opción de ${label}` })
    } else if (group[none] === 1 && selected > 1) {
      ctx.addIssue({ code: 'custom', path: [none], message: `"${none === 'ninguno' ? 'Ninguno' : 'Ninguna'}" excluye las demás opciones` })
    }
  })
}

export const ScreeningSchema = z
  .object({
    /** Código seudonimizado: nunca cédula ni nombre (RNF01.2). */
    codigo_paciente: z
      .string({ error: 'Requerido' })
      .trim()
      .min(3, 'Mínimo 3 caracteres')
      .max(32, 'Máximo 32 caracteres')
      .regex(/^[A-Za-z0-9-]+$/, 'Solo letras, números y guiones')
      .refine((v) => !/^\d{6,}$/.test(v), 'Parece una cédula: use el código seudonimizado'),

    v8_tiempo_diagnostico: intRange(0, 80),
    v9: exclusiveGroup(
      z.object({
        dieta_ejercicio: binary,
        orales: binary,
        insulina: binary,
        orales_insulina: binary,
        ninguno: binary,
      }),
      'ninguno',
      'tratamiento',
    ),
    v11: exclusiveGroup(
      z.object({
        ninguna: binary,
        hipertension: binary,
        cardiaca: binary,
        obesidad: binary,
        otra: binary,
      }),
      'ninguna',
      'comorbilidades',
    ),
    v12_percepcion_salud: intRange(1, 5),
    v13_apoyo_familiar: intRange(1, 5),
    v14_actividad_fisica: intRange(0, 3),
    v15_calidad_sueno: intRange(1, 5),

    who5_items: z.array(intRange(0, 5), { error: 'Requerido' }).length(5),
    /** El ítem 21 admite `null` = no evaluable (activa R1). */
    dass21_items: z
      .array(intRange(0, 3).nullable(), { error: 'Requerido' })
      .length(21)
      .superRefine((items, ctx) => {
        items.forEach((item, i) => {
          if (item === null && i !== 20) {
            ctx.addIssue({ code: 'custom', path: [i], message: 'Solo el ítem 21 puede ser "no evaluable"' })
          }
        })
      }),

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

/** Único punto donde el formulario se traduce a la entrada del modelo. */
export function buildModelInput(f: ScreeningForm): ModelInput {
  return {
    V8_TiempoDiagnosticoDM2: f.v8_tiempo_diagnostico,
    V9_Trat_DietaEjercicio: f.v9.dieta_ejercicio,
    V9_Trat_Orales: f.v9.orales,
    V9_Trat_Insulina: f.v9.insulina,
    V9_Trat_OralesInsulina: f.v9.orales_insulina,
    V9_Trat_Ninguno: f.v9.ninguno,
    V11_Enf_Ninguna: f.v11.ninguna,
    V11_Enf_Hipertension: f.v11.hipertension,
    V11_Enf_Cardiaca: f.v11.cardiaca,
    V11_Enf_Obesidad: f.v11.obesidad,
    V11_Enf_Otra: f.v11.otra,
    V12_PercepcionSalud: f.v12_percepcion_salud,
    V14_ActividadFisica: f.v14_actividad_fisica,
    V15_CalidadSueno: f.v15_calidad_sueno,
    WHO5_Total: who5Total(f.who5_items),
  }
}
