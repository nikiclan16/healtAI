import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MODEL_CARD } from '@/config/app'
import { Card, Icon } from '@/components/ui'
import { DecisionPanel } from '@/features/decision/DecisionPanel'
import { services } from '@/services'
import type { Confidence, Evaluation } from '@/services/types'
import { ROUTE_ACTIONS } from './actions'
import { ShapChart } from './ShapChart'

const CONFIDENCE: Record<Confidence, { dot: string; text: string }> = {
  Alta: { dot: 'bg-emerald-500', text: 'Coincide con el consenso unánime o mayoritario de los modelos retadores (KNN, MLP y consenso).' },
  Media: { dot: 'bg-amber-500', text: 'Concordancia parcial con los modelos retadores: interprete la ruta con cautela.' },
  Baja: { dot: 'bg-red-500', text: 'Los modelos retadores discrepan: la ruta debe confirmarse con el criterio clínico.' },
}

const cardLabel = 'block text-[11px] font-semibold uppercase tracking-wider text-slate-400'
const box = 'space-y-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm'

/** Resultado del tamizaje: estratificación (RF04), motor de reglas (RF05) y decisión humana (RF06). */
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
  const baseIsA = p.rutaBase === 'A'
  const finalIsA = rutaSistema === 'A'
  const conf = p.confianza ? CONFIDENCE[p.confianza] : null
  const mlpAgrees = p.retadores ? Math.abs(p.retadores.mlp - p.probabilidadRA) < 0.1 : false
  const actions = ROUTE_ACTIONS[rutaSistema]

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-cuc-blue">Requisito Funcional 04</span>
        <h1 className="text-xl font-bold text-slate-900">Estratificación, Nivel de Confianza y Explicabilidad (XAI)</h1>
        <p className="mt-1 font-mono text-xs text-slate-500">
          {evaluation.codigoPaciente} · {evaluation.sede} · {new Date(evaluation.creadoEn).toLocaleString('es-CO')} · {evaluation.profesional.nombre}
        </p>
        <p className="font-mono text-[11px] text-slate-400">
          sistema v{evaluation.versiones.app} · modelo {evaluation.versiones.modelo} · diccionario {evaluation.versiones.diccionario}
        </p>
      </div>

      {p.modeloPlaceholder && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          <Icon name="flask" className="text-lg" />
          MODELO DE PRUEBA ({p.versionModelo}): esta predicción usa valores de ejemplo y NO es una estimación clínica.
        </div>
      )}

      {reglas.suicideAlert && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border-2 border-cuc-alert bg-red-50 p-4 text-sm font-bold text-red-800">
          <Icon name="triangle-exclamation" className="text-lg" />
          ALERTA DE RIESGO SUICIDA (R1): escalamiento obligatorio a Ruta A.
        </div>
      )}

      {/* RF04 · tarjetas principales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={box}>
          <span className={cardLabel}>Estratificación Supervisada</span>
          <div className="flex items-baseline gap-2">
            <span className={`font-mono text-3xl font-extrabold ${baseIsA ? 'text-cuc-alert' : 'text-cuc-green'}`}>{(p.probabilidadRA * 100).toFixed(1)}%</span>
            <span className="font-mono text-xs text-slate-500">P(RA)</span>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-slate-600">Ruta Base Estimada:</span>
            <span className={`rounded border px-2 py-0.5 text-xs font-bold ${baseIsA ? 'border-red-200 bg-red-100 text-red-800' : 'border-emerald-200 bg-emerald-100 text-emerald-800'}`}>
              {baseIsA ? 'Ruta A (Atención Prioritaria)' : 'Ruta B (Seguimiento)'}
            </span>
          </div>
          <div className="pt-1 text-[10px] text-slate-400">Umbral institucional de decisión: P(RA) ≥ 50.0%</div>
        </div>

        <div className={box}>
          <span className={cardLabel}>Robustez de Predicción</span>
          {conf && p.confianza ? (
            <>
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${conf.dot}`} />
                <span className="text-xl font-bold text-slate-800">{p.confianza} Confianza</span>
              </div>
              <p className="text-xs text-slate-600">{conf.text}</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-slate-300" />
                <span className="text-xl font-bold text-slate-500">No disponible</span>
              </div>
              <p className="text-xs text-slate-600">Los modelos retadores (KNN, MLP y consenso) aún no están conectados; no se muestra un nivel de confianza.</p>
            </>
          )}
          {p.retadores && (
            <p className="font-mono text-[10px] text-slate-500">
              KNN {(p.retadores.knn * 100).toFixed(1)}% · MLP {(p.retadores.mlp * 100).toFixed(1)}% · Consenso {(p.retadores.consenso * 100).toFixed(1)}%
            </p>
          )}
          {mlpAgrees && (
            <div className="w-fit rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Concordancia con Red Neuronal</div>
          )}
        </div>

        <div className={box}>
          <span className={cardLabel}>Artefacto Productivo</span>
          <div className="text-sm font-bold text-slate-800">{MODEL_CARD.nombre}</div>
          <div className="space-y-1 font-mono text-xs text-slate-500">
            {MODEL_CARD.detalles.map((d) => <div key={d}>• {d}</div>)}
          </div>
        </div>
      </div>

      {/* RF04 · explicabilidad */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Icon name="chart-bar" className="text-cuc-blue" />
            <h2 className="text-xs font-bold text-slate-800 sm:text-sm">Explicabilidad Individual (Linear SHAP Values - Top Factores)</h2>
          </div>
          <span className="font-mono text-[11px] text-slate-500">Valores de impacto local</span>
        </div>
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2">
          <ShapChart factors={p.shapTop3} />
          <div className="space-y-2 text-xs">
            {p.shapTop3.map((f) => {
              const risk = f.direccion === 'riesgo'
              return (
                <div key={f.variable} className={`flex items-start gap-2 rounded-lg border p-2.5 ${risk ? 'border-red-100 bg-red-50' : 'border-emerald-100 bg-emerald-50'}`}>
                  <Icon name={risk ? 'arrow-trend-up' : 'shield-heart'} className={`mt-0.5 ${risk ? 'text-red-600' : 'text-emerald-600'}`} />
                  <div>
                    <span className={`font-bold ${risk ? 'text-red-900' : 'text-emerald-900'}`}>{f.etiqueta} ({f.valor > 0 ? '+' : ''}{f.valor.toFixed(3)})</span>
                    {f.descripcion && <p className={`text-[11px] ${risk ? 'text-red-700' : 'text-emerald-700'}`}>{f.descripcion}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* RF05 · motor de reglas */}
      <div className="border-b border-slate-200 pb-3 pt-2">
        <span className="text-xs font-bold uppercase tracking-wider text-cuc-blue">Requisito Funcional 05</span>
        <h2 className="text-xl font-bold text-slate-900">Motor de Reglas Clínicas de Seguridad (R1 a R5)</h2>
      </div>

      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${finalIsA ? 'border-red-200 bg-red-50/80' : 'border-emerald-200 bg-emerald-50'}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full text-lg text-white ${finalIsA ? 'bg-red-600' : 'bg-emerald-600'}`}>
            <Icon name={finalIsA ? 'triangle-exclamation' : 'check'} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Ruta Clínica Recomendada:{' '}
              <span className={finalIsA ? 'text-red-700' : 'text-emerald-700'}>
                {finalIsA ? 'RUTA A (Atención Prioritaria en Salud Mental)' : 'RUTA B (Seguimiento Programado)'}
              </span>
            </h3>
            <p className="text-xs text-slate-600">
              {evaluation.escalada
                ? 'Paciente escalado automáticamente de Ruta B a Ruta A por activación de reglas psicométricas de seguridad.'
                : 'Evaluación coherente con la estratificación y los protocolos de bienestar.'}
            </p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 font-mono text-xs font-bold ${finalIsA ? 'bg-red-200 text-red-900' : 'bg-emerald-200 text-emerald-900'}`}>
          {reglas.triggered.length} Reglas Activadas
        </span>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-xs font-bold text-slate-800 sm:text-sm">
          <Icon name="list-check" className="text-cuc-blue" />
          <span>Estado del Motor Determinístico de Reglas Clínicas</span>
        </h3>

        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
          {reglas.outcomes.map((o) => (
            <div
              key={o.code}
              className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${o.triggered ? 'border-red-300 bg-red-50 text-red-900' : 'border-slate-200 bg-slate-50 text-slate-600'} ${o.code === 'R5' || o.code === 'SEG' ? 'md:col-span-2' : ''}`}
            >
              <div>
                <div className="font-bold">{o.code === 'SEG' ? 'Regla de Seguridad' : `Regla ${o.code}`}: {o.name}</div>
                <div className="text-[11px] text-slate-500">{o.detail}</div>
              </div>
              <span className={`font-mono font-bold ${o.triggered ? 'text-red-600' : 'text-slate-400'}`}>{o.triggered ? 'ACTIVADA' : 'INACTIVA'}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-800">{actions.title}</span>
          <div className="grid grid-cols-1 gap-2 text-xs text-slate-700 sm:grid-cols-2">
            {actions.items.map((a) => (
              <div key={a} className="flex items-center gap-2">
                <Icon name="check" className="text-cuc-green" />
                <span>{a}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RF06 · decisión humana */}
      <DecisionPanel evaluation={evaluation} onSaved={setEvaluation} />
    </div>
  )
}
