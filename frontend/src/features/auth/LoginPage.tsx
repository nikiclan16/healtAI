import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { API_MODE, APP_NAME, CONVENIO, SITES } from '@/config/app'
import { Field, btnPrimary, inputClass } from '@/components/ui'
import { VersionBadge } from '@/components/VersionBadge'
import { services } from '@/services'
import type { SiteCode } from '@/services/types'
import { isSessionValid, useAuthStore } from './authStore'

const LoginSchema = z.object({
  usuario: z.string().trim().min(1, 'Ingrese su usuario'),
  password: z.string().min(1, 'Ingrese su contraseña'),
  sede: z.enum(['BAQ', 'RHA', 'VUP'], { error: 'Seleccione la sede' }),
  consentimiento: z.literal(true, { error: 'Debe aceptar la política de tratamiento de datos' }),
})
type LoginForm = z.infer<typeof LoginSchema>

export function LoginPage() {
  const session = useAuthStore((s) => s.session)
  const setSession = useAuthStore((s) => s.setSession)
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { usuario: '', password: '' },
  })
  const sede = watch('sede')

  if (isSessionValid(session)) return <Navigate to="/" replace />

  const state = location.state as { from?: string; expired?: boolean } | null

  async function onSubmit(values: LoginForm) {
    setError(null)
    try {
      const s = await services.auth.login({ usuario: values.usuario, password: values.password, sede: values.sede })
      setSession(s)
      navigate(state?.from ?? '/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible iniciar sesión')
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-slate-100 to-blue-50 px-4 py-8">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="flex items-center justify-between bg-cuc-navy p-5 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-sm font-bold text-cuc-navy">CUC</span>
            <div>
              <h1 className="text-base font-bold">Portal de Acceso Clínico</h1>
              <p className="text-xs text-slate-300">{APP_NAME} · Universidad de la Costa</p>
            </div>
          </div>
          <span className="rounded-full bg-blue-900/60 px-2.5 py-1 font-mono text-[11px] text-blue-200">HTTPS</span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 p-6">
          {state?.expired && (
            <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Su sesión expiró. Ingrese nuevamente.</p>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>
          )}

          <Field label="Usuario institucional" error={errors.usuario?.message}>
            <input type="email" autoComplete="username" className={inputClass} {...register('usuario')} />
          </Field>
          <Field label="Contraseña" error={errors.password?.message}>
            <input type="password" autoComplete="current-password" className={inputClass} {...register('password')} />
          </Field>

          <Field label="Centro de atención primaria (sede)" error={errors.sede?.message}>
            <div role="radiogroup" aria-label="Sede" className="grid grid-cols-3 gap-2">
              {Object.values(SITES).map((s) => {
                const selected = sede === s.code
                return (
                  <button
                    key={s.code}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setValue('sede', s.code as SiteCode, { shouldValidate: true })}
                    className={`rounded-lg border p-2.5 text-left text-xs transition ${
                      selected ? 'border-cuc-blue bg-cuc-light font-bold text-cuc-blue' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block">{s.ciudad}</span>
                    <span className="font-mono text-[10px] text-slate-500">{s.code}</span>
                  </button>
                )
              })}
            </div>
          </Field>

          <div>
            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input type="checkbox" className="mt-0.5" {...register('consentimiento')} />
              <span>Acepto la política de tratamiento de datos personales (Ley 1581 de 2012) y las directrices de investigación en salud (Res. 8430 de 1993).</span>
            </label>
            {errors.consentimiento && (
              <p role="alert" className="mt-1 text-[11px] font-medium text-cuc-alert">{errors.consentimiento.message}</p>
            )}
          </div>

          <button type="submit" disabled={isSubmitting} className={`${btnPrimary} w-full`}>
            {isSubmitting ? 'Verificando…' : 'Ingresar'}
          </button>

          {API_MODE === 'mock' && (
            <p className="rounded-lg bg-amber-50 p-3 text-[11px] text-amber-800">
              <strong>Modo demo:</strong> autenticación simulada. Usuarios de prueba definidos en <code>src/services/mock/users.ts</code>.
            </p>
          )}
        </form>
      </div>
      <p className="mt-4 text-center text-[11px] text-slate-500">
        Convenio {CONVENIO} · <VersionBadge />
      </p>
    </div>
  )
}
