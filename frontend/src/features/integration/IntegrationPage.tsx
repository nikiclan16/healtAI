import { useEffect, useRef, useState } from 'react'
import { Badge, Card, Icon, Modal } from '@/components/ui'
import { saveFile } from '@/lib/download'
import { services } from '@/services'
import { ANEXO_E } from '@/services/fixtures/anexoE'
import type { BatchResult, HealthStatus, PredictResponse } from '@/services/types'
import { batchResultToCsv } from './batchCsv'

const MAX_MB = 5
const MAX_ROWS_SHOWN = 200

/** Petición de ejemplo: el caso del Anexo E (datos sintéticos, no de un paciente real). */
const EJEMPLO = ANEXO_E

function errorText(e: unknown) {
  return e instanceof Error ? e.message : 'Ocurrió un error inesperado'
}

/** RF03 — Consumo del modelo: inferencia en tiempo real (API REST) y procesamiento por lotes. */
export function IntegrationPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-cuc-blue">Requisito Funcional 03</span>
        <h1 className="text-xl font-bold text-slate-900">Consumo de Modelo: Tiempo Real (API REST) y Modo Batch</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <RealTimeCard />
        <BatchCard />
      </div>
    </div>
  )
}

// ── Inferencia en tiempo real ───────────────────────────────────────────────────

function RealTimeCard() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState<{ title: string; body: string; error?: boolean } | null>(null)

  useEffect(() => {
    let cancelled = false
    services.model.health().then((h) => !cancelled && setHealth(h))
    return () => {
      cancelled = true
    }
  }, [])

  async function send() {
    setBusy(true)
    const t0 = performance.now()
    try {
      const r: PredictResponse = await services.model.predict(EJEMPLO)
      const ms = Math.round(performance.now() - t0)
      setModal({
        title: 'Respuesta HTTP 200 OK - FastAPI Microservice',
        body: JSON.stringify({ ...r, timestamp: new Date().toISOString(), latencia_ms: ms }, null, 2),
      })
    } catch (e) {
      setModal({ title: 'La API no respondió correctamente', body: errorText(e), error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="rounded bg-blue-100 px-2 py-1 font-mono text-xs font-bold text-cuc-blue">POST</span>
          <h2 className="text-sm font-bold text-slate-800">Inferencia en Tiempo Real</h2>
        </div>
        {health === null ? (
          <span className="font-mono text-[11px] text-slate-500">Verificando…</span>
        ) : health.ok ? (
          <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] text-emerald-600">● 200 OK</span>
        ) : (
          <span title={health.detalle} className="rounded border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[11px] text-red-700">● No disponible</span>
        )}
      </div>

      <p className="mb-3 text-xs text-slate-600">
        Comunicación directa con el microservicio FastAPI. Permite evaluar a un paciente durante su consulta clínica
        ambulatoria. <code className="font-mono">/predecir</code> solo calcula: no aplica reglas ni guarda datos.
      </p>

      <div className="mb-3 space-y-1 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-emerald-400">
        <div className="text-slate-400">// Petición JSON hacia /predecir (caso de ejemplo, datos sintéticos)</div>
        <pre className="whitespace-pre-wrap">{JSON.stringify(EJEMPLO)}</pre>
      </div>

      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-cuc-blue py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        <Icon name="play" />
        <span>{busy ? 'Enviando…' : 'Enviar Solicitud de Prueba a la API'}</span>
      </button>

      <Modal open={modal !== null} title={modal?.title ?? ''} onClose={() => setModal(null)}>
        <pre
          className={`max-h-80 overflow-auto rounded p-3 font-mono text-[11px] ${modal?.error ? 'bg-red-50 text-red-800' : 'bg-slate-900 text-emerald-400'}`}
        >
          {modal?.body}
        </pre>
      </Modal>
    </Card>
  )
}

// ── Procesamiento por lotes ─────────────────────────────────────────────────────

function BatchCard() {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BatchResult | null>(null)

  async function process(file: File | undefined) {
    if (!file) return
    setError(null)
    if (!/\.(csv|xlsx)$/i.test(file.name)) return setError('Formato no admitido: use un archivo .csv o .xlsx')
    if (file.size > MAX_MB * 1024 * 1024) return setError(`El archivo supera el máximo de ${MAX_MB} MB`)
    setBusy(true)
    try {
      setResult(await services.batch.upload(file))
    } catch (e) {
      setResult(null)
      setError(errorText(e))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function template() {
    try {
      saveFile(await services.batch.template())
    } catch (e) {
      setError(errorText(e))
    }
  }

  return (
    <>
      <Card>
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="rounded bg-amber-100 px-2 py-1 font-mono text-xs font-bold text-amber-800">BATCH</span>
            <h2 className="text-sm font-bold text-slate-800">Procesamiento por Lotes</h2>
          </div>
          <span className="font-mono text-[11px] text-slate-500">POST /lotes</span>
        </div>

        <p className="mb-3 text-xs text-slate-600">
          Permite la carga periódica de las hojas de sistematización de las 3 ciudades (como la cohorte de 47 pacientes
          analizada en el entregable).
        </p>

        <div
          role="button"
          tabIndex={0}
          aria-label="Seleccionar archivo CSV o XLSX"
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void process(e.dataTransfer.files[0])
          }}
          className={`cursor-pointer space-y-2 rounded-xl border-2 border-dashed p-6 text-center transition ${dragging ? 'border-cuc-blue bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-cuc-blue hover:bg-blue-50/30'}`}
        >
          <Icon name="file-excel" className="text-3xl text-emerald-600" />
          <div className="text-xs font-semibold text-slate-700">
            {busy ? 'Procesando…' : 'Arrastra aquí el archivo CSV/XLSX'}
          </div>
          <p className="text-[11px] text-slate-400">Verificación automática de columnas conforme al Diccionario v2.1</p>
          <input
            ref={input}
            type="file"
            accept=".csv,.xlsx"
            hidden
            onChange={(e) => void process(e.target.files?.[0])}
          />
        </div>

        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>}

        <div className="flex items-center justify-between pt-3 text-xs">
          <span className="font-mono text-slate-500">Máx. {MAX_MB} MB · 2000 filas</span>
          <button type="button" onClick={template} className="font-semibold text-cuc-blue hover:underline">
            <Icon name="download" className="mr-1" />
            Descargar plantilla CSV
          </button>
        </div>
      </Card>

      {result && <BatchResultCard result={result} />}
    </>
  )
}

function BatchResultCard({ result }: { result: BatchResult }) {
  const r = result.resumen
  const shown = result.resultados.slice(0, MAX_ROWS_SHOWN)

  function download() {
    saveFile({
      blob: new Blob([batchResultToCsv(result)], { type: 'text/csv;charset=utf-8' }),
      filename: `resultados_${result.archivo.replace(/\.[^.]+$/, '')}.csv`,
    })
  }

  return (
    <Card title="Procesamiento por Lotes Exitoso" className="md:col-span-2">
      {result.modeloPlaceholder && (
        <p role="alert" className="mb-3 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          MODELO DE PRUEBA: estos resultados no son clínicos.
        </p>
      )}
      <div className="grid gap-4 text-xs md:grid-cols-2">
        <div className="space-y-1 rounded bg-slate-100 p-3 font-mono text-[11px]">
          <div>• Archivo: <strong>{result.archivo}</strong></div>
          <div>• Sujetos procesados: {r.procesadas} de {r.filas}{r.conError > 0 && <span className="text-cuc-alert"> ({r.conError} con error)</span>}</div>
          <div>• Clasificación base: {r.baseRA} RA / {r.baseRB} RB</div>
          <div>• Escalamiento por motor: {r.escaladas} promovidos a Ruta A</div>
          <div>• Ruta final sugerida: {r.finalA} Ruta A / {r.finalB} Ruta B</div>
          <div className="break-all">• Integridad SHA-256: {result.sha256}</div>
          <div>• Modelo {result.versiones.modelo} · Diccionario {result.versiones.diccionario}</div>
        </div>
        <div className="space-y-2 text-slate-600">
          <p>
            El lote es una <strong>inferencia de apoyo</strong>: no crea evaluaciones ni decisiones. La validación
            humana de cada paciente se hace en el flujo de tamizaje individual.
          </p>
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Icon name="file-csv" className="text-emerald-600" />
            Descargar resultados (CSV con SHAP individual)
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="py-2 pr-3">Fila</th>
              <th className="pr-3">P(RA)</th>
              <th className="pr-3">Ruta base</th>
              <th className="pr-3">Ruta sugerida</th>
              <th className="pr-3">Reglas</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.fila} className="border-t border-slate-100">
                <td className="py-1.5 pr-3 font-mono">{row.fila}</td>
                {row.ok ? (
                  <>
                    <td className="pr-3 font-mono">{((row.probabilidadRA ?? 0) * 100).toFixed(1)}%</td>
                    <td className="pr-3">Ruta {row.rutaBase}</td>
                    <td className="pr-3">
                      <Badge tone={row.rutaSistema === 'A' ? 'danger' : 'ok'}>Ruta {row.rutaSistema}</Badge>
                      {row.escalada && <span className="ml-1 text-[10px] font-semibold text-cuc-alert">escalada</span>}
                    </td>
                    <td className="pr-3 font-mono">{row.reglas?.join(', ') || '—'}</td>
                    <td className="text-slate-500">{row.shapTop3?.map((s) => s.etiqueta).join(' · ')}</td>
                  </>
                ) : (
                  <td colSpan={5} className="font-medium text-cuc-alert">{row.error}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {result.resultados.length > shown.length && (
          <p className="pt-2 text-[11px] text-slate-500">
            Se muestran las primeras {MAX_ROWS_SHOWN} filas; el CSV descargable contiene todas.
          </p>
        )}
      </div>
    </Card>
  )
}
