import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { AUTH_MODE, SITES } from '@/config/app'
import { Icon, btnPrimary } from '@/components/ui'
import { services } from '@/services'
import type { CargoOption } from '@/services'
import { isSessionValid, useAuthStore } from './authStore'

const LoginSchema = z.object({
  usuario: z.string().trim().min(1, 'Ingrese su identificación'),
  password: z.string().min(1, 'Ingrese su contraseña'),
  cargo: z.string().min(1, 'Seleccione su rol operativo'),
  sede: z.enum(['BAQ', 'RHA', 'VUP'], { error: 'Seleccione la sede' }),
  consentimiento: z.literal(true, { error: 'Debe aceptar la política de tratamiento de datos' }),
})
type LoginForm = z.infer<typeof LoginSchema>

const fieldInput =
  'w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-cuc-blue'

function FieldError({ message }: { message?: string }) {
  return message ? <p role="alert" className="mt-1 text-[11px] font-medium text-cuc-alert">{message}</p> : null
}

/** Portal de acceso clínico (mockup RF01). */
export function LoginPage() {
  const session = useAuthStore((s) => s.session)
  const setSession = useAuthStore((s) => s.setSession)
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [cargos, setCargos] = useState<CargoOption[]>([])
  const [cargosError, setCargosError] = useState(false)

  // Los roles los administra el servidor: se consultan al abrir el portal.
  useEffect(() => {
    let cancelled = false
    services.auth
      .listCargos()
      .then((list) => !cancelled && setCargos(list))
      .catch(() => !cancelled && setCargosError(true))
    return () => {
      cancelled = true
    }
  }, [])

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
      const s = await services.auth.login({
        usuario: values.usuario,
        password: values.password,
        cargo: values.cargo,
        sede: values.sede,
      })
      setSession(s)
      navigate(state?.from ?? '/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible iniciar sesión')
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-linear-to-br from-slate-50 to-blue-50/40 p-6">
      <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-lg">
        <div className="flex items-center justify-between bg-cuc-navy p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10">
              <Icon name="lock" className="text-lg text-cuc-gold" />
            </div>
            <div>
              <h1 className="text-base font-bold">Portal de Acceso Clínico</h1>
              <p className="text-xs text-slate-300">Universidad de la Costa · Estratificación IA DM2</p>
            </div>
          </div>
          <span className="rounded-full border border-blue-400/30 bg-blue-900/60 px-2.5 py-1 font-mono text-[11px] text-blue-200">TLS 1.3 / HTTPS</span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 p-6 text-xs">
          {state?.expired && (
            <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-800">Su sesión expiró. Ingrese nuevamente.</p>
          )}
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 font-medium text-red-700">{error}</p>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="usuario" className="mb-1 block font-semibold text-slate-700">Identificación del Evaluador</label>
              <div className="relative">
                <Icon name="user-doctor" className="absolute left-3 top-2.5 text-slate-400" />
                <input id="usuario" type="email" autoComplete="username" placeholder="usuario@cuc.edu.co" className={fieldInput} {...register('usuario')} />
              </div>
              <FieldError message={errors.usuario?.message} />
            </div>

            <div>
              <label htmlFor="cargo" className="mb-1 block font-semibold text-slate-700">Rol Operativo Asignado</label>
              <select id="cargo" defaultValue="" className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-cuc-blue" {...register('cargo')}>
                <option value="" disabled>Seleccione su rol…</option>
                {cargos.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <FieldError message={errors.cargo?.message} />
              {cargosError && <FieldError message="No se pudieron cargar los roles: verifique la conexión con el servidor" />}
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block font-semibold text-slate-700">Contraseña</label>
            <div className="relative">
              <Icon name="key" className="absolute left-3 top-2.5 text-slate-400" />
              <input id="password" type="password" autoComplete="current-password" className={fieldInput} {...register('password')} />
            </div>
            <FieldError message={errors.password?.message} />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">Centro de Atención Primaria (Sede del Estudio)</label>
            <div role="radiogroup" aria-label="Sede" className="grid grid-cols-3 gap-2">
              {Object.values(SITES).map((s) => {
                const selected = sede === s.code
                return (
                  <button
                    key={s.code}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setValue('sede', s.code, { shouldValidate: true })}
                    className={`rounded-lg border p-2.5 text-left transition ${
                      selected ? 'border-cuc-blue bg-blue-50/70 font-bold text-cuc-blue shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon name="hospital" className="text-cuc-blue" />
                      <span>{s.ciudad}</span>
                    </span>
                    <span className="block text-[10px] font-normal text-slate-500">{s.centro}</span>
                  </button>
                )
              })}
            </div>
            <FieldError message={errors.sede?.message} />
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <Icon name="shield-halved" className="mt-0.5 text-emerald-600" />
            <div className="text-[11px] text-slate-600">
              <span className="font-semibold text-slate-800">Seudonimización Activa:</span> Los registros se procesan conforme a la Ley 1581 de 2012 y Res. 8430 de 1993. Los datos personales son disociados antes del envío al backend.
            </div>
          </div>

          <div>
            <label className="flex items-start gap-2 text-[11px] text-slate-600">
              <input type="checkbox" className="mt-0.5" {...register('consentimiento')} />
              <span>Acepto la Política de Tratamiento de Datos (Ley 1581 de 2012 y Res. 8430 de 1993).</span>
            </label>
            <FieldError message={errors.consentimiento?.message} />
          </div>

          <button type="submit" disabled={isSubmitting} className={`${btnPrimary} w-full`}>
            <Icon name="arrow-right-to-bracket" />
            <span>{isSubmitting ? 'Verificando…' : 'Confirmar Credenciales y Continuar a Tamizaje'}</span>
          </button>

          {import.meta.env.DEV && AUTH_MODE === 'mock' && (
            <p className="rounded-lg bg-amber-50 p-3 text-[11px] text-amber-800">
              <strong>Modo demo:</strong> autenticación simulada. Usuarios de prueba y roles permitidos en <code>src/services/mock/users.ts</code>. En producción el servidor valida que el usuario tenga asignado el rol elegido.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
