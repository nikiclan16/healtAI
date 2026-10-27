import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { BinaryCheck, Badge, Card, Field, OptionGroup, inputClass } from '@/components/ui'
import { SCALE_LABEL, dassLevel, dassScores, who5Percent } from '@/rules'
import type { ScreeningForm } from '@/services/contract'
import {
  ACTIVITY_4,
  ADA_4,
  DASS_ITEM_SCALE,
  DASS_ITEM_TEXT,
  DASS_OPTIONS,
  HEALTH_5,
  SUPPORT_5,
  WHO5_ITEMS,
  WHO5_OPTIONS,
} from './instruments'

const V9_OPTIONS = [
  ['dieta_ejercicio', 'Dieta y ejercicio'],
  ['orales', 'Hipoglucemiantes orales'],
  ['insulina', 'Insulina'],
  ['orales_insulina', 'Orales + insulina'],
  ['ninguno', 'Ninguno'],
] as const

const V11_OPTIONS = [
  ['ninguna', 'Ninguna'],
  ['hipertension', 'Hipertensión'],
  ['cardiaca', 'Cardíaca'],
  ['obesidad', 'Obesidad'],
  ['otra', 'Otra'],
] as const

/** Paso 1 — Datos clínicos (V8, V9, V11, V12, ADA). */
export function StepClinical() {
  const { register, control, formState: { errors } } = useFormContext<ScreeningForm>()
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Código del paciente (seudonimizado)" hint="No ingrese cédula ni nombre" error={errors.codigo_paciente?.message}>
          <input className={inputClass} autoComplete="off" {...register('codigo_paciente')} />
        </Field>
        <Field label="V8 · Tiempo de diagnóstico de DM2 (años, 0–80)" error={errors.v8_tiempo_diagnostico?.message}>
          <input type="number" min={0} max={80} className={inputClass} {...register('v8_tiempo_diagnostico', { valueAsNumber: true })} />
        </Field>
      </div>

      <Field label="V9 · Tratamiento actual (puede marcar varias)" error={errors.v9?.ninguno?.message ?? errors.v9?.message}>
        <div className="grid gap-2 sm:grid-cols-3">
          {V9_OPTIONS.map(([key, label]) => (
            <Controller key={key} control={control} name={`v9.${key}`} render={({ field }) => <BinaryCheck label={label} value={field.value} onChange={field.onChange} />} />
          ))}
        </div>
      </Field>

      <Field label="V11 · Comorbilidades (puede marcar varias)" error={errors.v11?.ninguna?.message ?? errors.v11?.message}>
        <div className="grid gap-2 sm:grid-cols-3">
          {V11_OPTIONS.map(([key, label]) => (
            <Controller key={key} control={control} name={`v11.${key}`} render={({ field }) => <BinaryCheck label={label} value={field.value} onChange={field.onChange} />} />
          ))}
        </div>
      </Field>

      <Field label="V12 · Percepción de salud" error={errors.v12_percepcion_salud?.message}>
        <Controller control={control} name="v12_percepcion_salud" render={({ field }) => <OptionGroup label="Percepción de salud" value={field.value} onChange={field.onChange} options={HEALTH_5} />} />
      </Field>

      <Field label="Nivel de riesgo de amputación (ADA/IWGDF)" hint="Solo uso clínico y reglas de seguridad: NO se envía al modelo predictivo." error={errors.nivel_riesgo_amputacion?.message}>
        <Controller control={control} name="nivel_riesgo_amputacion" render={({ field }) => <OptionGroup label="Nivel de riesgo de amputación" value={field.value} onChange={field.onChange} options={ADA_4} columns="grid-cols-2 sm:grid-cols-4" />} />
      </Field>
    </div>
  )
}

/** Paso 2 — Hábitos y soporte (V14, V15, V13). */
export function StepHabits() {
  const { control, formState: { errors } } = useFormContext<ScreeningForm>()
  return (
    <div className="space-y-6">
      <Field label="V14 · Actividad física" error={errors.v14_actividad_fisica?.message}>
        <Controller control={control} name="v14_actividad_fisica" render={({ field }) => <OptionGroup label="Actividad física" value={field.value} onChange={field.onChange} options={ACTIVITY_4} columns="grid-cols-2 sm:grid-cols-4" />} />
      </Field>
      <Field label="V15 · Calidad del sueño" error={errors.v15_calidad_sueno?.message}>
        <Controller control={control} name="v15_calidad_sueno" render={({ field }) => <OptionGroup label="Calidad del sueño" value={field.value} onChange={field.onChange} options={HEALTH_5} />} />
      </Field>
      <Field label="V13 · Apoyo familiar percibido" hint="Insumo del motor de recomendaciones; no entra al clasificador." error={errors.v13_apoyo_familiar?.message}>
        <Controller control={control} name="v13_apoyo_familiar" render={({ field }) => <OptionGroup label="Apoyo familiar" value={field.value} onChange={field.onChange} options={SUPPORT_5} />} />
      </Field>
    </div>
  )
}

/** Paso 3 — WHO-5 (5 ítems, 0–5). */
export function StepWho5() {
  const { control, formState: { errors } } = useFormContext<ScreeningForm>()
  const items = useWatch({ control, name: 'who5_items' }) ?? []
  const total = items.reduce((acc, v) => acc + (v ?? 0), 0)
  const pct = who5Percent(total)

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">Durante las últimas dos semanas…</p>
      {WHO5_ITEMS.map((text, i) => (
        <Field key={i} label={`${i + 1}. ${text}`} error={errors.who5_items?.[i]?.message}>
          <Controller control={control} name={`who5_items.${i}`} render={({ field }) => <OptionGroup label={text} value={field.value} onChange={field.onChange} options={WHO5_OPTIONS} columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" />} />
        </Field>
      ))}
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-cuc-light p-3 text-sm">
        <span className="font-semibold text-cuc-navy">Puntaje bruto: <span className="font-mono">{total} / 25</span></span>
        <span className="font-semibold text-cuc-navy">Equivalencia: <span className="font-mono">{pct} %</span></span>
        {pct <= 28 && <Badge tone="danger">≤ 28 %: probable depresión (R3)</Badge>}
      </div>
    </div>
  )
}

/** Paso 4 — DASS-21 (21 ítems, 0–3) + valoración del profesional. */
export function StepDass() {
  const { control, register, formState: { errors } } = useFormContext<ScreeningForm>()
  const items = useWatch({ control, name: 'dass21_items' }) ?? []
  const scores = dassScores(items)
  const scales = (['depresion', 'ansiedad', 'estres'] as const).map((s) => ({
    key: s,
    score: scores[s],
    level: dassLevel(s, scores[s]),
  }))

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {scales.map((s) => (
          <div key={s.key} className="rounded-lg bg-cuc-light p-3 text-sm">
            <div className="text-xs font-semibold text-cuc-navy">{SCALE_LABEL[s.key]} (0–21)</div>
            <div className="font-mono text-lg font-bold">{s.score}</div>
            <Badge tone={s.level === 'severo' || s.level === 'extremo' ? 'danger' : s.level === 'moderado' ? 'warn' : 'neutral'}>{s.level}</Badge>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {Array.from({ length: 21 }, (_, i) => {
          const n = i + 1
          const isCritical = n === 21
          return (
            <div key={n} className={isCritical ? 'rounded-lg border-2 border-cuc-alert bg-red-50 p-3' : ''}>
              <Field
                label={`${n}. ${DASS_ITEM_TEXT(n)} · ${SCALE_LABEL[DASS_ITEM_SCALE[n]]}${isCritical ? ' · ÍTEM CRÍTICO (R1)' : ''}`}
                hint={isCritical ? 'Un valor ≥ 2 o "no evaluable" activa la alerta de riesgo suicida y el escalamiento obligatorio a Ruta A.' : undefined}
                error={errors.dass21_items?.[i]?.message ?? (isCritical ? errors.dass21_items?.message : undefined)}
              >
                <Controller
                  control={control}
                  name={`dass21_items.${i}`}
                  render={({ field }) => (
                    <div className="space-y-2">
                      <OptionGroup label={`Ítem ${n}`} value={field.value ?? undefined} onChange={field.onChange} options={DASS_OPTIONS} columns="grid-cols-2 sm:grid-cols-4" />
                      {isCritical && (
                        <label className="flex items-center gap-2 text-xs font-semibold text-red-800">
                          <input type="checkbox" checked={field.value === null} onChange={(e) => field.onChange(e.target.checked ? null : undefined)} />
                          No evaluable (se trata como riesgo suicida)
                        </label>
                      )}
                    </div>
                  )}
                />
              </Field>
            </div>
          )
        })}
      </div>

      <Card title="Valoración del profesional (regla de seguridad)">
        <p className="mb-3 text-xs text-slate-500">Marque si observa alguna de estas situaciones. Fuerzan Ruta A y no pueden degradarse desde el software.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('alertas_profesional.riesgo_suicida')} /> Riesgo suicida</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('alertas_profesional.deterioro_agudo')} /> Deterioro clínico agudo</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('alertas_profesional.riesgo_urgente')} /> Riesgo clínico urgente</label>
        </div>
      </Card>
    </div>
  )
}
