import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/components/ui'
import { adminApi } from './adminApi'
import type { AdminRole, AdminSite } from './adminApi'
import { RolesTab } from './RolesTab'
import { UsersTab } from './UsersTab'

type Tab = 'usuarios' | 'roles'

/** Panel de administración: usuarios y roles operativos. */
export function AdminPage() {
  const [tab, setTab] = useState<Tab>('usuarios')
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [sites, setSites] = useState<AdminSite[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadRoles = useCallback(async () => {
    try {
      setRoles(await adminApi.roles())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los roles')
    }
  }, [])

  useEffect(() => {
    void loadRoles()
    adminApi.sedes().then(setSites).catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las sedes'))
  }, [loadRoles])

  const tabClass = (t: Tab) =>
    `flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition ${tab === t ? 'border-cuc-blue text-cuc-blue' : 'border-transparent text-slate-500 hover:text-slate-800'}`

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Usuarios y roles</h1>
        <p className="text-xs text-slate-500">Cree los roles operativos y las cuentas del personal de las 3 sedes (Barranquilla, Riohacha y Valledupar).</p>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>}

      <div role="tablist" className="flex border-b border-slate-200">
        <button role="tab" aria-selected={tab === 'usuarios'} className={tabClass('usuarios')} onClick={() => setTab('usuarios')}>
          <Icon name="users" /> Usuarios
        </button>
        <button role="tab" aria-selected={tab === 'roles'} className={tabClass('roles')} onClick={() => setTab('roles')}>
          <Icon name="id-badge" /> Roles
        </button>
      </div>

      {tab === 'usuarios' ? <UsersTab roles={roles} sites={sites} /> : <RolesTab roles={roles} onChanged={() => void loadRoles()} />}
    </div>
  )
}
