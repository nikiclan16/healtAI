import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { MODEL_CARD } from '@/config/app'
import { Field, Icon, Modal, NumSelect, Slider, inputClass } from '@/components/ui'
import { who5Percent } from '@/rules'
import { ApiValidationError, services } from '@/services'
import { ScreeningSchema } from '@/services/contract'
import type { ScreeningForm } from '@/services/contract'
import { ANEXO_E } from '@/services/fixtures/anexoE'
import {
  FAMILY_SUPPORT,
  HEALTH_PERCEPTION,
  ITEM21_OPTIONS,
  PHYSICAL_ACTIVITY,
  SLEEP_QUALITY,
  TREATMENT_OPTIONS,
} from './instruments'

const DEFAULTS = {
  v11: { hipertension: false, cardiaca: false, obesidad: false, otra: false },
  alertas_profesional: { riesgo_suicida: false, deterioro_agudo: false, riesgo_urgente: false },
}

/** Campos obligatorios contestados (V11 es opcional: sin marcas = "Ninguna"). */
function answeredCount(v: Partial<ScreeningForm>): { answered: number; total: number } {
  const isNum = (x: unknown) => typeof x === 'number' && !Number.isNaN(x)
  const checks = [
    isNum(v.v8_tiempo_diagnostico),
    Boolean(v.v9_tratamiento),
    isNum(v.v12_percepcion_salud),
    isNum(v.v14_actividad_fisica),
    isNum(v.v15_calidad_sueno),
    isNum(v.v13_apoyo_familiar),
    isNum(v.who5_total),
    isNum(v.dass_depresion),
    isNum(v.dass_ansiedad),
    isNum(v.dass_estres),
    v.dass_item21 === null || isNum(v.dass_item21),
  ]
  return { answered: checks.filter(Boolean).length, total: checks.length }
}

function SectionTitle({ n, tone, children }: { n: number; tone: string; children: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${tone}`}>{n}</div>
      <h2 className="text-xs font-bold text-slate-800">{children}</h2>
    </div>
  )
}

const panel = 'space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm'

/** Captura del contrato de datos S2 + WHO-5 + DASS-21 (mockup RF02). */
export function ScreeningPage() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ campo: string; mensaje: string }[]>([])
  const [modal, setModal] = useState<{ title: string; body: React.ReactNode; onClose?: () => void } | null>(null)

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ScreeningForm>({
    resolver: zodResolver(ScreeningSchema),
    defaultValues: DEFAULTS,
    mode: 'onChange',
  })
  const values = watch()
  const { answered, total } = answeredCount(values)
  const valid = ScreeningSchema.safeParse(values).success

  async function submit(data: ScreeningForm) {
    setBusy(true)
    setError(null)
    setFieldErrors([])
    try {
      // El servidor ejecuta la inferencia, el motor de reglas y el registro (POST /evaluaciones).
      const evaluation = await services.evaluations.submit(data)
      const { prediccion, reglas } = evaluation
      const go = () => navigate(`/evaluacion/${evaluation.id}`)
      setModal({
        title: 'Inferencia Ejecutada con Éxito',
        onClose: go,
        body: (
          <>
            <p>Se evaluaron las {Object.keys(evaluation.entrada).length} variables de entrada con el modelo <strong>{MODEL_CARD.nombre}</strong>.</p>
            <p>
              Probabilidad P(RA): <strong>{(prediccion.probabilidadRA * 100).toFixed(1)}%</strong> | Ruta Base: <strong>{prediccion.rutaBase === 'A' ? 'RA' : 'RB'}</strong>
            </p>
            <p className="text-emerald-700">El motor de reglas de salud mental activó {reglas.triggered.length} reglas clínicas.</p>
          </>
        ),
      })
    } catch (e) {
      if (e instanceof ApiValidationError) setFieldErrors(e.fields)
      setError(e instanceof Error ? e.message : 'No se pudo completar la evaluación')
    } finally {
      setBusy(false)
    }
  }

  function loadExample() {
    reset(ANEXO_E)
    setModal({
      title: 'Caso Anexo E Cargado',
      body: <p>Se han cargado los valores representativos del Anexo E del Documento Técnico: paciente con 10 años de DM2, hipertensión, calidad de sueño mala, bienestar bajo (8 pts) y ansiedad severa (8 pts).</p>,
    })
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-cuc-blue">Requisito Funcional 02</span>
            <h1 className="text-xl font-bold text-slate-900">Formulario Clínico Estandarizado (Contrato de Datos)</h1>
          </div>
          <span className="rounded border bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-700">Validación HTTP 422 Pre-Inferencia</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">Ingreso de variables del subconjunto S2 (15 variables), escala de bienestar WHO-5 y cuestionario DASS-21 con prevención estricta de fuga de datos.</p>
      </div>

      <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-xs ${valid ? 'border-blue-200 bg-blue-50 text-cuc-blue' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        <span className="flex items-center gap-2">
          <Icon name={valid ? 'circle-check' : 'circle-exclamation'} className={`text-sm ${valid ? 'text-emerald-600' : 'text-amber-600'}`} />
          {valid ? (
            <span><strong>Contrato de Datos Validado:</strong> 15 variables del subconjunto S2 listas para inferencia sin valores nulos.</span>
          ) : (
            <span><strong>Contrato de Datos incompleto:</strong> {answered} de {total} campos obligatorios completados.</span>
          )}
        </span>
        {import.meta.env.DEV && (
          <button type="button" onClick={loadExample} className="rounded bg-cuc-blue px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700">
            Recargar Valores Anexo E
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* 1 · Variables clínicas DM2 */}
          <div className={panel}>
            <SectionTitle n={1} tone="bg-blue-100 text-cuc-blue">Variables Clínicas DM2</SectionTitle>

            <Controller
              control={control}
              name="v8_tiempo_diagnostico"
              render={({ field }) => (
                <Field
                  label="V8: Tiempo Diagnóstico"
                  error={errors.v8_tiempo_diagnostico?.message}
                  right={<span className="font-mono text-xs font-bold text-cuc-blue">{field.value === undefined ? 'Sin responder' : `${field.value} años`}</span>}
                >
                  <Slider label="V8 Tiempo de diagnóstico (años)" min={0} max={80} value={field.value} onChange={field.onChange} />
                  <div className="flex justify-between text-[10px] text-slate-400"><span>Recién diagn. (0)</span><span>80 años</span></div>
                </Field>
              )}
            />

            <Field label="V9: Esquema Terapéutico" error={errors.v9_tratamiento?.message}>
              <select aria-label="V9 Esquema terapéutico" className={`${inputClass} cursor-pointer`} defaultValue="" {...register('v9_tratamiento')}>
                <option value="">Seleccione…</option>
                {TREATMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>

            <Field label="V11: Comorbilidades Médicas">
              <div className="space-y-1.5 text-xs text-slate-700">
                {([['hipertension', 'Hipertensión Arterial (HTA)'], ['cardiaca', 'Enfermedad Cardíaca'], ['obesidad', 'Obesidad'], ['otra', 'Otra']] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox" className="rounded text-cuc-blue" {...register(`v11.${key}`)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </Field>
          </div>

          {/* 2 · Hábitos y funcionalidad */}
          <div className={panel}>
            <SectionTitle n={2} tone="bg-emerald-100 text-emerald-800">Hábitos y Funcionalidad</SectionTitle>
            {([
              ['v12_percepcion_salud', 'V12: Percepción de Salud (1-5)', HEALTH_PERCEPTION],
              ['v14_actividad_fisica', 'V14: Actividad Física Frecuencia', PHYSICAL_ACTIVITY],
              ['v15_calidad_sueno', 'V15: Calidad del Sueño', SLEEP_QUALITY],
              ['v13_apoyo_familiar', 'V13: Apoyo Familiar Percibido', FAMILY_SUPPORT],
            ] as const).map(([name, label, options]) => (
              <Field key={name} label={label} error={errors[name]?.message}>
                <Controller control={control} name={name} render={({ field }) => <NumSelect label={label} value={field.value} onChange={field.onChange} options={[...options]} />} />
              </Field>
            ))}
          </div>

          {/* 3 · Tamizaje psicométrico */}
          <div className={panel}>
            <SectionTitle n={3} tone="bg-amber-100 text-amber-800">Tamizaje Psicométrico</SectionTitle>

            <Controller
              control={control}
              name="who5_total"
              render={({ field }) => (
                <Field
                  label="Índice WHO-5 (0 a 25)"
                  error={errors.who5_total?.message}
                  right={
                    <span className="font-mono text-xs font-bold text-amber-600">
                      {field.value === undefined ? 'Sin responder' : `${field.value} / 25 (${who5Percent(field.value)}%)`}
                    </span>
                  }
                >
                  <Slider label="Índice WHO-5" min={0} max={25} value={field.value} onChange={field.onChange} accent="accent-amber-500" />
                  <div className="text-[10px] text-slate-500">Punto de corte: ≤7 (28%) = probable depresión.</div>
                </Field>
              )}
            />

            <div className="space-y-2 border-t border-slate-100 pt-1">
              <div className="text-[11px] font-semibold text-slate-700">Subescalas DASS-21 (0-21 c/u)</div>
              <div className="grid grid-cols-3 gap-2">
                {([['dass_depresion', 'Depresión'], ['dass_ansiedad', 'Ansiedad'], ['dass_estres', 'Estrés']] as const).map(([name, label]) => (
                  <div key={name}>
                    <span className="block text-[10px] text-slate-500">{label}</span>
                    <Controller
                      control={control}
                      name={name}
                      render={({ field }) => (
                        <input
                          type="number"
                          min={0}
                          max={21}
                          aria-label={`DASS-21 ${label}`}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                          className="w-full rounded border border-slate-300 p-1.5 text-center font-mono text-xs font-bold"
                        />
                      )}
                    />
                    {errors[name] && <p role="alert" className="mt-0.5 text-[10px] font-medium text-cuc-alert">{errors[name]?.message}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50/70 p-2.5">
              <label htmlFor="item21" className="mb-1 block text-[11px] font-bold text-red-900">Ítem 21 DASS-21 (Sensibilidad Crítica)</label>
              <Controller
                control={control}
                name="dass_item21"
                render={({ field }) => (
                  <select
                    id="item21"
                    value={field.value === null ? 'ne' : field.value === undefined ? '' : String(field.value)}
                    onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value === 'ne' ? null : Number(e.target.value))}
                    className="w-full cursor-pointer rounded border border-red-300 bg-white px-2 py-1 text-xs font-semibold text-red-800 outline-none"
                  >
                    <option value="">Seleccione…</option>
                    {ITEM21_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
              />
              {errors.dass_item21 && <p role="alert" className="mt-1 text-[11px] font-medium text-cuc-alert">{errors.dass_item21.message}</p>}
            </div>
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-xs font-bold text-slate-800"><Icon name="user-shield" className="mr-1.5 text-cuc-blue" />Valoración del profesional (regla de seguridad)</h2>
          <p className="mb-2 text-[11px] text-slate-500">Marque si observa alguna de estas situaciones. Fuerzan Ruta A y no pueden degradarse desde el software.</p>
          <div className="grid gap-2 text-xs sm:grid-cols-3">
            <label className="flex items-center gap-2"><input type="checkbox" {...register('alertas_profesional.riesgo_suicida')} /> Riesgo suicida</label>
            <label className="flex items-center gap-2"><input type="checkbox" {...register('alertas_profesional.deterioro_agudo')} /> Deterioro clínico agudo</label>
            <label className="flex items-center gap-2"><input type="checkbox" {...register('alertas_profesional.riesgo_urgente')} /> Riesgo clínico urgente</label>
          </div>
        </section>

        {error && (
          <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p className="font-semibold">{error}</p>
            {fieldErrors.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-xs">
                {fieldErrors.map((f) => <li key={f.campo}>{f.campo}: {f.mensaje}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          {!valid && <span className="self-center text-[11px] text-slate-500">{answered}/{total} campos completados</span>}
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-cuc-green px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <Icon name="microchip" />
            <span>{busy ? 'Procesando…' : 'Ejecutar Inferencia & Evaluar Reglas de Salud Mental'}</span>
          </button>
        </div>
      </form>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
        <h4 className="flex items-center gap-1.5 font-bold text-slate-800">
          <Icon name="shield-virus" className="text-emerald-700" />
          <span>Control de Fuga de Información (Data Leakage)</span>
        </h4>
        <p className="text-slate-600">
          El <strong>Nivel_de_Riesgo de amputación</strong> (ADA/IWGDF) está aislado del modelo clasificador predictivo ya que generaba separación perfecta en el análisis exploratorio. Solo se utiliza en la regla clínica de seguridad del motor de recomendaciones.
        </p>
      </div>

      <Modal
        open={modal !== null}
        title={modal?.title ?? ''}
        onClose={() => {
          const after = modal?.onClose
          setModal(null)
          after?.()
        }}
      >
        {modal?.body}
      </Modal>
    </div>
  )
}
