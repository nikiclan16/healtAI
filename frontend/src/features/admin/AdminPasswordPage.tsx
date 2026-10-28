import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui'
import { ChangePasswordForm } from '@/features/auth/ChangePasswordForm'
import { adminApi } from './adminApi'
import { useAdminStore } from './adminStore'

/** Cambio de la contraseña del administrador (obligatorio si la actual es temporal). */
export function AdminPasswordPage() {
  const forced = useAdminStore((s) => s.session?.debeCambiarPassword ?? false)
  const passwordChanged = useAdminStore((s) => s.passwordChanged)
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Cambiar contraseña</h1>
      <Card>
        <ChangePasswordForm
          forced={forced}
          onSubmit={(actual, nueva) => adminApi.changePassword(actual, nueva).then(() => undefined)}
          onDone={() => {
            passwordChanged()
            navigate('/admin', { replace: true })
          }}
        />
      </Card>
    </div>
  )
}
