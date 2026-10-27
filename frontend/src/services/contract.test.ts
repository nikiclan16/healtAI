import { describe, expect, it } from 'vitest'
import { buildModelInput, ScreeningSchema } from './contract'
import { ANEXO_E } from './fixtures/anexoE'

const clone = () => structuredClone(ANEXO_E)

describe('ScreeningSchema', () => {
  it('acepta el caso Anexo E', () => {
    expect(ScreeningSchema.safeParse(ANEXO_E).success).toBe(true)
  })

  it.each([
    ['V8 > 80', (f: ReturnType<typeof clone>) => (f.v8_tiempo_diagnostico = 81)],
    ['V8 < 0', (f: ReturnType<typeof clone>) => (f.v8_tiempo_diagnostico = -1)],
    ['V12 = 0', (f: ReturnType<typeof clone>) => (f.v12_percepcion_salud = 0)],
    ['V14 = 4', (f: ReturnType<typeof clone>) => (f.v14_actividad_fisica = 4)],
    ['ítem DASS = 4', (f: ReturnType<typeof clone>) => (f.dass21_items[0] = 4)],
    ['ítem WHO-5 = 6', (f: ReturnType<typeof clone>) => (f.who5_items[0] = 6)],
    ['ADA = 5', (f: ReturnType<typeof clone>) => (f.nivel_riesgo_amputacion = 5)],
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

  it('"Ninguno" en tratamiento excluye las demás opciones', () => {
    const f = clone()
    f.v9 = { dieta_ejercicio: 1, orales: 0, insulina: 0, orales_insulina: 0, ninguno: 1 }
    expect(ScreeningSchema.safeParse(f).success).toBe(false)
  })

  it('exige al menos una comorbilidad u "Ninguna"', () => {
    const f = clone()
    f.v11 = { ninguna: 0, hipertension: 0, cardiaca: 0, obesidad: 0, otra: 0 }
    expect(ScreeningSchema.safeParse(f).success).toBe(false)
  })

  it('solo el ítem 21 puede ser no evaluable (null)', () => {
    const ok = clone()
    ok.dass21_items[20] = null
    expect(ScreeningSchema.safeParse(ok).success).toBe(true)
    const bad = clone()
    bad.dass21_items[3] = null
    expect(ScreeningSchema.safeParse(bad).success).toBe(false)
  })
})

describe('buildModelInput', () => {
  it('produce las 15 variables de S2', () => {
    expect(Object.keys(buildModelInput(ANEXO_E))).toHaveLength(15)
  })

  it('calcula WHO5_Total a partir de los ítems', () => {
    expect(buildModelInput(ANEXO_E).WHO5_Total).toBe(8)
  })

  it('NUNCA incluye Nivel_de_Riesgo, V13 ni DASS-21 (RF02.4)', () => {
    const keys = Object.keys(buildModelInput(ANEXO_E)).join(' ').toLowerCase()
    expect(keys).not.toMatch(/riesgo|ada|v13|apoyo|dass/)
  })
})
