import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Icon, btnPrimary } from '@/components/ui'
import { adminApi } from './adminApi'
import { isAdminSessionValid, useAdminStore } from './adminStore'

const Schema = z.object({
  usuario: z.string().trim().min(1, 'Ingrese su correo de administrador'),
  password: z.string().min(1, 'Ingrese su contraseña'),
})
type Form = z.infer<typeof Schema>

const fieldInput =
  'w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-cuc-blue'

/** Acceso de administración (URL /admin/login), independiente del portal clínico. */
export function AdminLoginPage() {
  const session = useAdminStore((s) => s.session)
  const setSession = useAdminStore((s) => s.setSession)
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(Schema), defaultValues: { usuario: '', password: '' } })

  if (isAdminSessionValid(session)) return <Navigate to="/admin" replace />
  const expired = (location.state as { expired?: boolean } | null)?.expired

  async function onSubmit(values: Form) {
    setError(null)
    try {
      const r = await adminApi.login(values.usuario, values.password)
      setSession({ token: r.access_token, expiresAt: Date.now() + r.expires_in * 1000, user: r.usuario })
      navigate('/admin', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible iniciar sesión')
    }
  }

  return (
    <div className="mx-auto mt-6 max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
      <div className="flex items-center gap-3 bg-cuc-navy p-5 text-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10">
          <Icon name="user-shield" className="text-lg text-cuc-gold" />
        </div>
        <div>
          <h1 className="text-base font-bold">Acceso de Administración</h1>
          <p className="text-xs text-slate-300">Gestión de usuarios y roles</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 p-6 text-xs">
        {expired && <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-800">Su sesión de administración expiró. Ingrese nuevamente.</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 font-medium text-red-700">{error}</p>}

        <div>
          <label htmlFor="usuario" className="mb-1 block font-semibold text-slate-700">Correo de administrador</label>
          <div className="relative">
            <Icon name="envelope" className="absolute left-3 top-2.5 text-slate-400" />
            <input id="usuario" type="email" autoComplete="username" className={fieldInput} {...register('usuario')} />
          </div>
          {errors.usuario && <p role="alert" className="mt-1 text-[11px] font-medium text-cuc-alert">{errors.usuario.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block font-semibold text-slate-700">Contraseña</label>
          <div className="relative">
            <Icon name="key" className="absolute left-3 top-2.5 text-slate-400" />
            <input id="password" type="password" autoComplete="current-password" className={fieldInput} {...register('password')} />
          </div>
          {errors.password && <p role="alert" className="mt-1 text-[11px] font-medium text-cuc-alert">{errors.password.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting} className={`${btnPrimary} w-full`}>
          <Icon name="arrow-right-to-bracket" />
          <span>{isSubmitting ? 'Verificando…' : 'Ingresar a administración'}</span>
        </button>
        <p className="text-[11px] text-slate-500">Tras 5 intentos fallidos la cuenta se bloquea 15 minutos. La sesión dura 60 minutos.</p>
      </form>
    </div>
  )
}
