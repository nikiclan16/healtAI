import { useEffect, useState } from 'react'
import { Badge, Card, Icon } from '@/components/ui'
import { saveFile } from '@/lib/download'
import { services } from '@/services'
import type { InvestigatorMetrics } from '@/services/types'

const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`)
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error inesperado')

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </div>
  )
}

/** Panel del investigador (solo lectura): métricas por sede, concordancia, reglas y exportaciones. */
export function InvestigatorPage() {
  const [data, setData] = useState<InvestigatorMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'evaluaciones' | 'auditoria' | null>(null)

  useEffect(() => {
    let cancelled = false
    services.investigator
      .metrics()
      .then((m) => !cancelled && setData(m))
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [])

  async function exportFile(kind: 'evaluaciones' | 'auditoria') {
    setExporting(kind)
    setError(null)
    try {
      saveFile(await (kind === 'evaluaciones' ? services.investigator.exportEvaluations() : services.investigator.exportAudit()))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setExporting(null)
    }
  }

  if (error && !data) return <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>
  if (!data) return <p className="text-sm text-slate-500">Cargando métricas…</p>

  const t = data.totales
  const maxRegla = Math.max(1, ...Object.values(data.reglas))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Panel del investigador</h1>
          <p className="text-xs text-slate-500">Solo lectura · los datos llevan únicamente el código seudonimizado del paciente</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportFile('evaluaciones')}
            disabled={exporting !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Icon name="file-csv" className="text-emerald-600" />
            {exporting === 'evaluaciones' ? 'Exportando…' : 'Exportar evaluaciones (CSV)'}
          </button>
          <button
            type="button"
            onClick={() => exportFile('auditoria')}
            disabled={exporting !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Icon name="shield-halved" className="text-cuc-blue" />
            {exporting === 'auditoria' ? 'Exportando…' : 'Descargar bitácora de auditoría'}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Evaluaciones" value={t.evaluaciones} />
        <Kpi label="Con decisión" value={t.decisiones} hint={`${t.pendientes} pendientes`} />
        <Kpi label="Ruta A sugerida" value={t.rutaA} />
        <Kpi label="Escaladas por reglas" value={t.escaladas} />
        <Kpi label="Concordancia" value={pct(t.concordancia)} hint="modelo vs. profesional" />
        <Kpi label="Bitácora" value={data.auditoria.eventos} hint={data.auditoria.integra ? 'cadena íntegra' : 'CADENA ALTERADA'} />
      </div>

      <Card title="Métricas por sede">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2 pr-4">Sede</th>
                <th className="pr-4">Evaluaciones</th>
                <th className="pr-4">Ruta A</th>
                <th className="pr-4">Escaladas</th>
                <th className="pr-4">Decisiones</th>
                <th>Concordancia</th>
              </tr>
            </thead>
            <tbody>
              {data.sedes.map((s) => (
                <tr key={s.sede} className="border-t border-slate-100">
                  <td className="py-2 pr-4"><span className="font-mono font-semibold">{s.sede}</span> · {s.nombre}</td>
                  <td className="pr-4">{s.evaluaciones}</td>
                  <td className="pr-4">{s.rutaA}</td>
                  <td className="pr-4">{s.escaladas}</td>
                  <td className="pr-4">{s.decisiones}</td>
                  <td>{pct(s.concordancia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Reglas clínicas activadas">
          {Object.keys(data.reglas).length === 0 ? (
            <p className="text-xs text-slate-500">Aún no hay evaluaciones con reglas activadas.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {Object.entries(data.reglas).map(([code, n]) => (
                <li key={code} className="flex items-center gap-3">
                  <span className="w-10 font-mono font-semibold">{code}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span className="block h-full rounded-full bg-cuc-blue" style={{ width: `${(n / maxRegla) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right font-mono">{n}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[11px] font-semibold text-slate-500">Acciones del profesional</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {(['confirmar', 'ajustar', 'rechazar'] as const).map((a) => (
              <Badge key={a} tone="neutral">{a}: {data.acciones[a] ?? 0}</Badge>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Concept Drift · concordancia modelo vs. profesional">
            <p className="text-2xl font-bold text-slate-900">{pct(data.conceptDrift.concordancia)}</p>
            <p className="text-xs text-slate-500">
              Ventana móvil de las últimas {data.conceptDrift.ventana} decisiones ({data.conceptDrift.decisiones} registradas).
              Una caída sostenida indica que el modelo se está alejando del criterio clínico.
            </p>
          </Card>
          <Card title="Data Drift · PSI y Kolmogorov-Smirnov">
            {data.dataDrift.disponible ? (
              <p className="text-xs text-slate-600">Disponible.</p>
            ) : (
              <p className="text-xs text-slate-600">
                <Badge tone="warn">Pendiente</Badge> {data.dataDrift.motivo}
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
