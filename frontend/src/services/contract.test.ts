import { describe, expect, it } from 'vitest'
import { buildModelInput, ScreeningSchema } from './contract'
import { ANEXO_E } from './fixtures/anexoE'

type Form = ReturnType<typeof structuredClone<typeof ANEXO_E>>
const clone = (): Form => structuredClone(ANEXO_E)

describe('ScreeningSchema', () => {
  it('acepta el caso Anexo E', () => {
    expect(ScreeningSchema.safeParse(ANEXO_E).success).toBe(true)
  })

  it.each([
    ['V8 > 80', (f: Form) => (f.v8_tiempo_diagnostico = 81)],
    ['V8 < 0', (f: Form) => (f.v8_tiempo_diagnostico = -1)],
    ['V12 = 0', (f: Form) => (f.v12_percepcion_salud = 0)],
    ['V14 = 4', (f: Form) => (f.v14_actividad_fisica = 4)],
    ['WHO-5 = 26', (f: Form) => (f.who5_total = 26)],
    ['WHO-5 = -1', (f: Form) => (f.who5_total = -1)],
    ['DASS depresión = 22', (f: Form) => (f.dass_depresion = 22)],
    ['DASS ansiedad = -1', (f: Form) => (f.dass_ansiedad = -1)],
    ['DASS estrés = 22', (f: Form) => (f.dass_estres = 22)],
    ['ítem 21 = 4', (f: Form) => (f.dass_item21 = 4)],
    ['ADA = 5', (f: Form) => (f.nivel_riesgo_amputacion = 5)],
  ])('rechaza %s', (_name, mutate) => {
    const f = clone()
    mutate(f)
    expect(ScreeningSchema.safeParse(f).success).toBe(false)
  })

  it('rechaza un código que parece cédula', () => {
    const f = clone()
    f.codigo_paciente = '1234567890'
    expect(ScreeningSchema.safeParse(f).success).toBe(false)
  })

  it('exige elegir un tratamiento', () => {
    const f = { ...clone(), v9_tratamiento: undefined }
    expect(ScreeningSchema.safeParse(f).success).toBe(false)
  })

  it('el ítem 21 admite null (no evaluable) pero no undefined', () => {
    const ok = clone()
    ok.dass_item21 = null
    expect(ScreeningSchema.safeParse(ok).success).toBe(true)
    const missing = { ...clone(), dass_item21: undefined }
    expect(ScreeningSchema.safeParse(missing).success).toBe(false)
  })
})

describe('buildModelInput', () => {
  it('produce las 15 variables de S2', () => {
    expect(Object.keys(buildModelInput(ANEXO_E))).toHaveLength(15)
  })

  it('mapea el tratamiento elegido a variables binarias excluyentes', () => {
    const m = buildModelInput(ANEXO_E)
    expect(m.V9_Trat_Orales).toBe(1)
    expect(m.V9_Trat_Insulina + m.V9_Trat_DietaEjercicio + m.V9_Trat_OralesInsulina + m.V9_Trat_Ninguno).toBe(0)
  })

  it('deriva "Ninguna" comorbilidad solo cuando no hay ninguna marcada', () => {
    expect(buildModelInput(ANEXO_E).V11_Enf_Ninguna).toBe(0)
    const none = clone()
    none.v11 = { hipertension: false, cardiaca: false, obesidad: false, otra: false }
    expect(buildModelInput(none).V11_Enf_Ninguna).toBe(1)
  })

  it('usa WHO5_Total del formulario', () => {
    expect(buildModelInput(ANEXO_E).WHO5_Total).toBe(8)
  })

  it('NUNCA incluye Nivel_de_Riesgo, V13 ni DASS-21 (RF02.4)', () => {
    const keys = Object.keys(buildModelInput(ANEXO_E)).join(' ').toLowerCase()
    expect(keys).not.toMatch(/riesgo|ada|v13|apoyo|dass/)
  })
})
