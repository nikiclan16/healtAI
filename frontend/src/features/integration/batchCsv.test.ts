import { describe, expect, it } from 'vitest'
import type { BatchResult } from '@/services/types'
import { batchResultToCsv } from './batchCsv'

const base: BatchResult = {
  archivo: 'lote.csv',
  sha256: 'a'.repeat(64),
  columnas: [],
  resumen: { filas: 2, procesadas: 1, conError: 1, baseRA: 1, baseRB: 0, escaladas: 0, finalA: 1, finalB: 0 },
  versiones: { app: '0', modelo: 'm', diccionario: 'v2.1' },
  modeloPlaceholder: false,
  resultados: [
    {
      fila: 2, ok: true, probabilidadRA: 0.7123, rutaBase: 'A', rutaSistema: 'A', escalada: false, reglas: ['R2', 'R4'],
      shapTop3: [{ variable: 'x', etiqueta: 'Comorbilidad, HTA', valor: -0.0312, direccion: 'protector', descripcion: '' }],
    },
    { fila: 3, ok: false, error: '=cmd|"x": valor inválido' },
  ],
}

describe('batchResultToCsv', () => {
  const lines = batchResultToCsv(base).replace('﻿', '').trim().split('\n')

  it('trae cabecera y una fila por sujeto', () => {
    expect(lines).toHaveLength(3)
    expect(lines[0].startsWith('fila,estado,probabilidad_ra')).toBe(true)
  })

  it('escribe las reglas y los factores SHAP, con números sin tocar', () => {
    expect(lines[1]).toContain('procesada,0.7123,A,A,0,"R2;R4","Comorbilidad, HTA",-0.0312')
  })

  it('neutraliza fórmulas y escapa comillas en los errores', () => {
    expect(lines[2]).toContain(`"'=cmd|""x"": valor inválido"`)
  })
})
