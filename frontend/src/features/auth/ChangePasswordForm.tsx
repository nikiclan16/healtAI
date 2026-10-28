import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Field, Icon, btnPrimary } from '@/components/ui'
import { passwordProblem } from './passwordPolicy'

const Schema = z
  .object({
    actual: z.string().min(1, 'Ingrese su contraseña actual'),
    nueva: z.string().superRefine((v, ctx) => {
      const problem = passwordProblem(v)
      if (problem) ctx.addIssue({ code: 'custom', message: problem })
    }),
    confirmar: z.string(),
  })
  .refine((v) => v.nueva === v.confirmar, { path: ['confirmar'], message: 'Las contraseñas no coinciden' })
  .refine((v) => v.nueva !== v.actual, { path: ['nueva'], message: 'La nueva contraseña debe ser distinta de la actual' })
type Values = z.infer<typeof Schema>

const input = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-cuc-blue'

/** Formulario de cambio de contraseña compartido por el acceso clínico y el de administración. */
export function ChangePasswordForm({
  onSubmit,
  onDone,
  forced = false,
}: {
  onSubmit: (actual: string, nueva: string) => Promise<void>
  onDone: () => void
  /** La contraseña actual es temporal: el cambio es obligatorio. */
  forced?: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { actual: '', nueva: '', confirmar: '' } })

  async function submit(values: Values) {
    setError(null)
    try {
      await onSubmit(values.actual, values.nueva)
      setDone(true)
      setTimeout(onDone, 900)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible cambiar la contraseña')
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4 text-xs">
      {forced && (
        <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-800">
          Su contraseña es temporal. Debe cambiarla para continuar.
        </p>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 font-medium text-red-700">{error}</p>}
      {done && <p role="status" className="rounded-lg bg-emerald-50 p-3 font-medium text-emerald-800">Contraseña actualizada.</p>}

      <Field label="Contraseña actual" error={errors.actual?.message}>
        <input type="password" autoComplete="current-password" className={input} {...register('actual')} />
      </Field>
      <Field label="Nueva contraseña" hint="Mínimo 10 caracteres, con letras y números." error={errors.nueva?.message}>
        <input type="password" autoComplete="new-password" className={input} {...register('nueva')} />
      </Field>
      <Field label="Confirmar nueva contraseña" error={errors.confirmar?.message}>
        <input type="password" autoComplete="new-password" className={input} {...register('confirmar')} />
      </Field>

      <button type="submit" disabled={isSubmitting || done} className={`${btnPrimary} w-full`}>
        <Icon name="key" />
        <span>{isSubmitting ? 'Guardando…' : 'Cambiar contraseña'}</span>
      </button>
    </form>
  )
}
