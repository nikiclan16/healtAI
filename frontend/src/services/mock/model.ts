import { MODEL_VERSION } from '@/config/app'
import type { ModelInput } from '../contract'
import type { ModelService } from '../interfaces'
import type { Confidence, ShapFactor } from '../types'
import { delay } from './auth'

/**
 * Modelo SIMULADO para desarrollo y demo: una heurística determinística que NO es el
 * modelo real (RegLog L2, S2). Se reemplaza por POST /predecir en modo `http`.
 */
function contributions(i: ModelInput): ShapFactor[] {
  const f = (variable: string, etiqueta: string, valor: number, descripcion: string): ShapFactor => ({
    variable,
    etiqueta,
    valor: Number(valor.toFixed(3)),
    direccion: valor >= 0 ? 'riesgo' : 'protector',
    descripcion,
  })
  const who5Pct = i.WHO5_Total * 4
  return [
    f('V11_Enf_Hipertension', 'Comorbilidad: hipertensión', i.V11_Enf_Hipertension * 0.2, 'Aumenta la probabilidad de Ruta A'),
    f('V11_Enf_Cardiaca', 'Comorbilidad: cardíaca', i.V11_Enf_Cardiaca * 0.2, 'Aumenta la probabilidad de Ruta A'),
    f('V11_Enf_Obesidad', 'Comorbilidad: obesidad', i.V11_Enf_Obesidad * 0.1, 'Aumenta la probabilidad de Ruta A'),
    f(
      'V9_Trat_Insulina',
      'Tratamiento con insulina',
      i.V9_Trat_Insulina * 0.15 + i.V9_Trat_OralesInsulina * 0.2,
      'La insulinoterapia se asocia a mayor necesidad asistencial',
    ),
    f(
      'V14_ActividadFisica',
      `Actividad física (nivel ${i.V14_ActividadFisica})`,
      (1.5 - i.V14_ActividadFisica) * 0.1,
      i.V14_ActividadFisica < 2 ? 'El sedentarismo incrementa la necesidad asistencial' : 'La actividad regular es un factor protector',
    ),
    f(
      'V15_CalidadSueno',
      `Calidad del sueño (${i.V15_CalidadSueno}/5)`,
      (3 - i.V15_CalidadSueno) * 0.08,
      i.V15_CalidadSueno < 3 ? 'El sueño deficiente favorece Ruta A' : 'Buen sueño: factor protector',
    ),
    f(
      'V12_PercepcionSalud',
      `Percepción de salud (${i.V12_PercepcionSalud}/5)`,
      (3 - i.V12_PercepcionSalud) * 0.08,
      i.V12_PercepcionSalud < 3 ? 'Mala percepción de salud favorece Ruta A' : 'Buena percepción de salud: factor protector',
    ),
    f(
      'WHO5_Total',
      `Bienestar WHO-5 (${i.WHO5_Total}/25)`,
      ((50 - who5Pct) / 100) * 0.6,
      who5Pct < 50 ? 'Bajo bienestar afectivo favorece Ruta A' : 'Buen bienestar afectivo: factor protector',
    ),
    f(
      'V8_TiempoDiagnosticoDM2',
      `Tiempo de diagnóstico (${i.V8_TiempoDiagnosticoDM2} años)`,
      (i.V8_TiempoDiagnosticoDM2 - 10) * 0.005,
      'Mayor tiempo de evolución se asocia a mayor necesidad asistencial',
    ),
  ]
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
const clamp01 = (x: number) => Math.min(0.99, Math.max(0.01, x))

export const mockModelService: ModelService = {
  async predict(input) {
    await delay(400)
    const contribs = contributions(input)
    const p = sigmoid(-0.1 + contribs.reduce((acc, c) => acc + c.valor, 0))

    // Retadores simulados que se separan según el perfil → confianza variable.
    const retadores = {
      knn: clamp01(p + (input.V12_PercepcionSalud - 3) * 0.04),
      mlp: clamp01(p - (input.V15_CalidadSueno - 3) * 0.05),
      consenso: clamp01(p),
    }
    const values = [p, retadores.knn, retadores.mlp]
    const spread = Math.max(...values) - Math.min(...values)
    const confianza: Confidence = spread < 0.08 ? 'Alta' : spread < 0.16 ? 'Media' : 'Baja'

    return {
      probabilidadRA: Number(p.toFixed(4)),
      rutaBase: p >= 0.5 ? 'A' : 'B',
      confianza,
      retadores,
      shapTop3: [...contribs].sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)).slice(0, 3),
      versionModelo: MODEL_VERSION,
    }
  },
  async health() {
    await delay(150)
    return { ok: true, versionModelo: MODEL_VERSION, detalle: 'Modelo simulado (modo demo)' }
  },
}
