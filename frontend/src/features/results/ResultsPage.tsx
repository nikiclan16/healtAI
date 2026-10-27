import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Card, btnSecondary } from '@/components/ui'
import { DecisionPanel } from '@/features/decision/DecisionPanel'
import { SCALE_LABEL } from '@/rules'
import { services } from '@/services'
import type { Evaluation } from '@/services/types'
import { ROUTE_ACTIONS } from './actions'
import { ShapChart } from './ShapChart'

const confTone = { Alta: 'ok', Media: 'warn', Baja: 'danger' } as const

export function ResultsPage() {
  const { id = '' } = useParams()
  const [evaluation, setEvaluation] = useState<Evaluation | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    services.evaluations.get(id).then((e) => !cancelled && setEvaluation(e))
    return () => {
      cancelled = true
    }
  }, [id])

  if (evaluation === undefined) return <p className="text-sm text-slate-500">Cargando…</p>
  if (evaluation === null) {
    return (
      <Card title="Evaluación no encontrada">
        <Link className="font-semibold text-cuc-blue hover:underline" to="/">Volver al inicio</Link>
      </Card>
    )
  }

  const { prediccion: p, reglas, rutaSistema } = evaluation
  const actions = ROUTE_ACTIONS[rutaSistema]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Resultado del tamizaje</h1>
          <p className="font-mono text-xs text-slate-500">
            {evaluation.codigoPaciente} · {evaluation.sede} · {new Date(evaluation.creadoEn).toLocaleString('es-CO')} · {evaluation.profesional.nombre}
          </p>
          <p className="font-mono text-[11px] text-slate-400">
            sistema v{evaluation.versiones.app} · modelo {evaluation.versiones.modelo} · diccionario {evaluation.versiones.diccionario}
          </p>
        </div>
        <button type="button" className={`${btnSecondary} no-print`} onClick={() => window.print()}>
          Exportar / imprimir PDF
        </button>
      </div>

      {reglas.suicideAlert && (
        <div role="alert" className="rounded-lg border-2 border-cuc-alert bg-red-50 p-4 text-sm font-bold text-red-800">
          ALERTA DE RIESGO SUICIDA (R1): escalamiento obligatorio a Ruta A.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Ruta sugerida">
          <div className={`rounded-lg p-4 text-center text-2xl font-extrabold text-white ${rutaSistema === 'A' ? 'bg-cuc-alert' : 'bg-cuc-green'}`}>
            Ruta {rutaSistema}
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Ruta base del modelo: <strong>Ruta {p.rutaBase}</strong>
            {evaluation.escalada && <> · <Badge tone="danger">Escalada por reglas</Badge></>}
          </p>
        </Card>

        <Card title="P(Ruta A)">
          <div className="font-mono text-3xl font-bold text-slate-900">{(p.probabilidadRA * 100).toFixed(1)} %</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-cuc-blue" style={{ width: `${p.probabilidadRA * 100}%` }} />
          </div>
        </Card>

        <Card title="Nivel de confianza">
          <Badge tone={confTone[p.confianza]}>{p.confianza}</Badge>
          {p.retadores && (
            <ul className="mt-2 space-y-0.5 font-mono text-xs text-slate-600">
              <li>KNN: {(p.retadores.knn * 100).toFixed(1)} %</li>
              <li>MLP: {(p.retadores.mlp * 100).toFixed(1)} %</li>
              <li>Consenso: {(p.retadores.consenso * 100).toFixed(1)} %</li>
            </ul>
          )}
        </Card>
      </div>

      <Card title="Factores determinantes (Top 3 SHAP)">
        <ShapChart factors={p.shapTop3} />
        <ul className="mt-3 space-y-1 text-xs text-slate-600">
          {p.shapTop3.map((f) => (
            <li key={f.variable}>
              <Badge tone={f.direccion === 'riesgo' ? 'danger' : 'ok'}>{f.direccion === 'riesgo' ? 'Aumenta riesgo' : 'Protector'}</Badge>{' '}
              <strong>{f.etiqueta}</strong> ({f.valor > 0 ? '+' : ''}{f.valor.toFixed(3)}) {f.descripcion && `— ${f.descripcion}`}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Motor de reglas de seguridad clínica">
        <ul className="space-y-2">
          {reglas.outcomes.map((o) => (
            <li key={o.code} className={`flex gap-3 rounded-lg border p-2 text-xs ${o.triggered ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
              <span className={`font-mono font-bold ${o.triggered ? 'text-cuc-alert' : 'text-slate-400'}`}>{o.code}</span>
              <span className="flex-1">
                <span className="font-semibold">{o.name}</span>
                <span className="block text-slate-600">{o.detail}</span>
              </span>
              <Badge tone={o.triggered ? 'danger' : 'neutral'}>{o.triggered ? 'Dispara' : 'No dispara'}</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          WHO-5: {reglas.who5Total}/25 ({reglas.who5Percent} %) · {(['depresion', 'ansiedad', 'estres'] as const)
            .map((s) => `${SCALE_LABEL[s]} ${reglas.scores[s]} (${reglas.levels[s]})`)
            .join(' · ')}
          {reglas.scores.depresionIncompleta && ' · Depresión calculada con ítems incompletos'}
        </p>
      </Card>

      <Card title={actions.title}>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
          {actions.items.map((a) => <li key={a}>{a}</li>)}
        </ul>
      </Card>

      <DecisionPanel evaluation={evaluation} onSaved={setEvaluation} />
    </div>
  )
}
