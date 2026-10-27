import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import type { FieldPath } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { API_MODE, APP_VERSION, DICTIONARY_VERSION } from '@/config/app'
import { Card, btnPrimary, btnSecondary } from '@/components/ui'
import { useAuthStore } from '@/features/auth/authStore'
import { evaluateRules, resolveRoute } from '@/rules'
import { ApiValidationError, services } from '@/services'
import { ScreeningSchema, buildModelInput } from '@/services/contract'
import type { ScreeningForm } from '@/services/contract'
import { ANEXO_E } from '@/services/fixtures/anexoE'
import { StepClinical, StepDass, StepHabits, StepWho5 } from './steps'

type FieldName = FieldPath<ScreeningForm>

const STEPS: { title: string; fields: FieldName[]; Component: () => React.JSX.Element }[] = [
  {
    title: 'Datos clínicos',
    fields: ['codigo_paciente', 'v8_tiempo_diagnostico', 'v9', 'v11', 'v12_percepcion_salud', 'nivel_riesgo_amputacion'],
    Component: StepClinical,
  },
  { title: 'Hábitos', fields: ['v14_actividad_fisica', 'v15_calidad_sueno', 'v13_apoyo_familiar'], Component: StepHabits },
  { title: 'WHO-5', fields: ['who5_items'], Component: StepWho5 },
  { title: 'DASS-21', fields: ['dass21_items', 'alertas_profesional'], Component: StepDass },
]

const EMPTY_BINARY = 0 as const
const DEFAULTS = {
  codigo_paciente: '',
  v9: { dieta_ejercicio: EMPTY_BINARY, orales: EMPTY_BINARY, insulina: EMPTY_BINARY, orales_insulina: EMPTY_BINARY, ninguno: EMPTY_BINARY },
  v11: { ninguna: EMPTY_BINARY, hipertension: EMPTY_BINARY, cardiaca: EMPTY_BINARY, obesidad: EMPTY_BINARY, otra: EMPTY_BINARY },
  who5_items: Array.from({ length: 5 }, () => undefined),
  dass21_items: Array.from({ length: 21 }, () => undefined),
  alertas_profesional: { riesgo_suicida: false, deterioro_agudo: false, riesgo_urgente: false },
}

const isNum = (x: unknown) => typeof x === 'number' && !Number.isNaN(x)

/** Respuestas contestadas / totales, para el indicador de completitud (RNF03.2). */
function completeness(v: ScreeningForm): { answered: number; total: number } {
  const checks = [
    (v.codigo_paciente?.trim().length ?? 0) >= 3,
    isNum(v.v8_tiempo_diagnostico),
    Object.values(v.v9 ?? {}).some((x) => x === 1),
    Object.values(v.v11 ?? {}).some((x) => x === 1),
    isNum(v.v12_percepcion_salud),
    isNum(v.nivel_riesgo_amputacion),
    isNum(v.v14_actividad_fisica),
    isNum(v.v15_calidad_sueno),
    isNum(v.v13_apoyo_familiar),
    ...(v.who5_items ?? []).map(isNum),
    ...(v.dass21_items ?? []).map((x) => x === null || isNum(x)),
  ]
  return { answered: checks.filter(Boolean).length, total: 9 + 5 + 21 }
}

export function ScreeningPage() {
  const session = useAuthStore((s) => s.session)!
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ campo: string; mensaje: string }[]>([])

  const methods = useForm<ScreeningForm>({
    resolver: zodResolver(ScreeningSchema),
    defaultValues: DEFAULTS,
    mode: 'onChange',
  })
  const { answered, total } = completeness(methods.watch())
  const last = step === STEPS.length - 1
  const { Component } = STEPS[step]

  async function next() {
    if (await methods.trigger(STEPS[step].fields)) setStep((s) => s + 1)
  }

  async function submit(data: ScreeningForm) {
    setBusy(true)
    setError(null)
    setFieldErrors([])
    try {
      const entrada = buildModelInput(data)
      const prediccion = await services.model.predict(entrada, {
        sede: session.sede,
        profesionalId: session.user.id,
        codigoPaciente: data.codigo_paciente,
      })
      const reglas = evaluateRules({
        dassItems: data.dass21_items,
        who5Items: data.who5_items,
        v13ApoyoFamiliar: data.v13_apoyo_familiar,
        v14ActividadFisica: data.v14_actividad_fisica,
        v15CalidadSueno: data.v15_calidad_sueno,
        alertasProfesional: data.alertas_profesional,
      })
      const { finalRoute, escalated } = resolveRoute(prediccion.rutaBase, reglas)
      const evaluation = await services.evaluations.create({
        codigoPaciente: data.codigo_paciente,
        sede: session.sede,
        profesional: { id: session.user.id, nombre: session.user.nombre },
        formulario: data,
        entrada,
        prediccion,
        reglas,
        rutaSistema: finalRoute,
        escalada: escalated,
        versiones: { app: APP_VERSION, modelo: prediccion.versionModelo, diccionario: DICTIONARY_VERSION },
      })
      navigate(`/evaluacion/${evaluation.id}`)
    } catch (e) {
      if (e instanceof ApiValidationError) setFieldErrors(e.fields)
      setError(e instanceof Error ? e.message : 'No se pudo completar la evaluación')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900">Nueva evaluación</h1>
        {API_MODE === 'mock' && (
          <button type="button" className={btnSecondary} onClick={() => { methods.reset(ANEXO_E); setStep(0) }}>
            Cargar caso Anexo E
          </button>
        )}
      </div>

      <nav aria-label="Pasos" className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.title}
            type="button"
            disabled={i > step}
            onClick={() => setStep(i)}
            aria-current={i === step ? 'step' : undefined}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              i === step ? 'bg-cuc-blue text-white' : i < step ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'
            }`}
          >
            {i + 1}. {s.title}
          </button>
        ))}
      </nav>

      <div>
        <div className="mb-1 flex justify-between text-[11px] text-slate-500">
          <span>Completitud</span>
          <span className="font-mono">{answered}/{total}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered}>
          <div className="h-full bg-cuc-green transition-all" style={{ width: `${(answered / total) * 100}%` }} />
        </div>
      </div>

      <FormProvider {...methods}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (last) void methods.handleSubmit(submit)(e)
            else void next()
          }}
        >
          <Card title={`Paso ${step + 1} de ${STEPS.length} · ${STEPS[step].title}`}>
            <Component />
          </Card>

          {error && (
            <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <p className="font-semibold">{error}</p>
              {fieldErrors.length > 0 && (
                <ul className="mt-1 list-inside list-disc text-xs">
                  {fieldErrors.map((f) => <li key={f.campo}>{f.campo}: {f.mensaje}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="mt-4 flex justify-between">
            <button type="button" className={btnSecondary} disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
              Atrás
            </button>
            <button type="submit" className={btnPrimary} disabled={busy}>
              {busy ? 'Procesando…' : last ? 'Calcular ruta' : 'Siguiente'}
            </button>
          </div>
        </form>
      </FormProvider>
    </div>
  )
}
