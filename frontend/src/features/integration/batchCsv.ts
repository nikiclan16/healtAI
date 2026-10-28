import type { BatchResult } from '@/services/types'

/** Una celda de texto: comillas dobles escapadas y sin fórmulas (evita inyección al abrir en Excel). */
function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return String(value)
  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Resultados del lote como CSV (con BOM para que Excel lea UTF-8): una fila por sujeto. */
export function batchResultToCsv(result: BatchResult): string {
  const header = [
    'fila', 'estado', 'probabilidad_ra', 'ruta_base', 'ruta_sistema', 'escalada', 'reglas',
    'shap_1', 'valor_1', 'shap_2', 'valor_2', 'shap_3', 'valor_3', 'error',
  ]
  const rows = result.resultados.map((r) => {
    const shap = r.shapTop3 ?? []
    return [
      r.fila,
      r.ok ? 'procesada' : 'error',
      r.probabilidadRA,
      r.rutaBase,
      r.rutaSistema,
      r.escalada === undefined ? '' : r.escalada ? 1 : 0,
      (r.reglas ?? []).join(';'),
      ...[0, 1, 2].flatMap((i) => [shap[i]?.etiqueta, shap[i]?.valor]),
      r.error,
    ]
      .map((v) => cell(v as string | number | null | undefined))
      .join(',')
  })
  return `﻿${[header.join(','), ...rows].join('\n')}\n`
}
