import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui'
import { services } from '@/services'
import { useAuthStore } from './authStore'
import { ChangePasswordForm } from './ChangePasswordForm'

/** Cambio de la contraseña propia. Si es temporal, el guard de rutas obliga a pasar por aquí. */
export function ChangePasswordPage() {
  const forced = useAuthStore((s) => s.session?.debeCambiarPassword ?? false)
  const passwordChanged = useAuthStore((s) => s.passwordChanged)
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Cambiar contraseña</h1>
      <Card>
        <ChangePasswordForm
          forced={forced}
          onSubmit={(actual, nueva) => services.auth.changePassword(actual, nueva)}
          onDone={() => {
            passwordChanged()
            navigate('/', { replace: true })
          }}
        />
      </Card>
    </div>
  )
}
