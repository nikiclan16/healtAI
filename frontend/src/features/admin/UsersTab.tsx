import { useCallback, useEffect, useState } from 'react'
import { Badge, Field, Icon, btnPrimary, btnSecondary, inputClass } from '@/components/ui'
import { adminApi } from './adminApi'
import type { AdminRole, AdminSite, AdminUser, Perfil } from './adminApi'
import { useAdminStore } from './adminStore'
import { PERFIL_LABEL, generatePassword } from './helpers'

interface FormState {
  id: string | null // null = creando
  email: string
  nombre: string
  password: string
  rol: Perfil
  cargos: string[]
  sedes: string[]
}

const EMPTY: FormState = { id: null, email: '', nombre: '', password: '', rol: 'evaluador', cargos: [], sedes: [] }
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

export function UsersTab({ roles, sites }: { roles: AdminRole[]; sites: AdminSite[] }) {
  const me = useAdminStore((s) => s.session?.user.id)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [q, setQ] = useState('')
  const [form, setForm] = useState<FormState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)

  const load = useCallback(async (query: string) => {
    try {
      setUsers(await adminApi.users(query || undefined))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los usuarios')
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => void load(q), 250)
    return () => clearTimeout(id)
  }, [q, load])

  const roleLabel = (code: string) => roles.find((r) => r.code === code)?.label ?? code
  const isAdminPerfil = form?.rol === 'admin'
  const availableRoles = roles.filter((r) => r.activo && r.rol === form?.rol)

  function startEdit(u: AdminUser) {
    setCreated(null)
    setError(null)
    setForm({ id: u.id, email: u.email, nombre: u.nombre, password: '', rol: u.rol, cargos: u.cargos, sedes: u.sedes })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setBusy(true)
    setError(null)
    try {
      if (form.id === null) {
        await adminApi.createUser({
          email: form.email.trim(),
          nombre: form.nombre.trim(),
          password: form.password,
          rol: form.rol,
          cargos: isAdminPerfil ? [] : form.cargos,
          sedes: isAdminPerfil ? [] : form.sedes,
        })
        setCreated({ email: form.email.trim(), password: form.password })
      } else {
        await adminApi.patchUser(form.id, {
          nombre: form.nombre.trim(),
          ...(form.password ? { password: form.password } : {}),
          ...(isAdminPerfil ? {} : { cargos: form.cargos, sedes: form.sedes }),
        })
        if (form.password) setCreated({ email: form.email, password: form.password })
      }
      setForm(null)
      await load(q)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el usuario')
    } finally {
      setBusy(false)
    }
  }

  async function setActive(u: AdminUser, activo: boolean) {
    if (!activo && !window.confirm(`¿Desactivar a ${u.nombre}? No podrá ingresar hasta que lo reactive.`)) return
    setError(null)
    try {
      await adminApi.patchUser(u.id, { activo })
      await load(q)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el usuario')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-xs">
          <Icon name="magnifying-glass" className="absolute left-3 top-2.5 text-slate-400" />
          <input
            aria-label="Buscar usuarios"
            className={`${inputClass} pl-8`}
            placeholder="Buscar por nombre o correo"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button type="button" className={btnPrimary} onClick={() => { setCreated(null); setError(null); setForm({ ...EMPTY, password: generatePassword() }) }}>
          <Icon name="user-plus" /> Nuevo usuario
        </button>
      </div>

      {created && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <p className="font-semibold">Guardado. Entregue esta contraseña a <span className="font-mono">{created.email}</span> por un canal seguro: no se puede volver a consultar.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded bg-white px-2 py-1 font-mono text-sm">{created.password}</code>
            <button type="button" className={btnSecondary} onClick={() => void navigator.clipboard?.writeText(created.password)}>Copiar</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>}

      {form && (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-bold text-slate-800">{form.id === null ? 'Nuevo usuario' : `Editar: ${form.email}`}</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre completo">
              <input className={inputClass} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required minLength={3} maxLength={120} />
            </Field>
            <Field label="Correo (usuario de acceso)">
              <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={form.id !== null} />
            </Field>
            <Field
              label={form.id === null ? 'Contraseña inicial' : 'Restablecer contraseña (opcional)'}
              hint="Mínimo 10 caracteres con letras y números. Se muestra una sola vez al guardar."
              right={<button type="button" className="text-[11px] font-semibold text-cuc-blue hover:underline" onClick={() => setForm({ ...form, password: generatePassword() })}>Generar</button>}
            >
              <input className={`${inputClass} font-mono`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={form.id === null} autoComplete="new-password" />
            </Field>
            <Field label="Perfil de acceso" hint={form.id !== null ? 'El perfil no se puede cambiar' : undefined}>
              <select
                className={`${inputClass} cursor-pointer`}
                value={form.rol}
                disabled={form.id !== null}
                onChange={(e) => setForm({ ...form, rol: e.target.value as Perfil, cargos: [], sedes: [] })}
              >
                {(Object.keys(PERFIL_LABEL) as Perfil[]).map((p) => <option key={p} value={p}>{PERFIL_LABEL[p]}</option>)}
              </select>
            </Field>
          </div>

          {isAdminPerfil ? (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Los administradores gestionan usuarios y roles; no tienen roles operativos ni sedes asignadas.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Roles operativos permitidos" hint={availableRoles.length === 0 ? 'No hay roles activos para este perfil. Cree uno en la pestaña Roles.' : undefined}>
                <div className="space-y-1.5">
                  {availableRoles.map((r) => (
                    <label key={r.code} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={form.cargos.includes(r.code)} onChange={() => setForm({ ...form, cargos: toggle(form.cargos, r.code) })} />
                      {r.label}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Sedes autorizadas">
                <div className="space-y-1.5">
                  {sites.map((s) => (
                    <label key={s.code} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={form.sedes.includes(s.code)} onChange={() => setForm({ ...form, sedes: toggle(form.sedes, s.code) })} />
                      {s.ciudad} <span className="font-mono text-[10px] text-slate-400">{s.code}</span>
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>{busy ? 'Guardando…' : form.id === null ? 'Crear usuario' : 'Guardar cambios'}</button>
            <button type="button" className={btnSecondary} onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2">Usuario</th>
              <th className="px-4">Perfil</th>
              <th className="px-4">Roles</th>
              <th className="px-4">Sedes</th>
              <th className="px-4">Estado</th>
              <th className="px-4" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No hay usuarios que coincidan.</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-2">
                  <div className="font-semibold text-slate-800">{u.nombre}</div>
                  <div className="font-mono text-[11px] text-slate-500">{u.email}</div>
                </td>
                <td className="px-4 py-2">{PERFIL_LABEL[u.rol]}</td>
                <td className="px-4 py-2">{u.cargos.length ? u.cargos.map(roleLabel).join(', ') : <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-2 font-mono">{u.sedes.length ? u.sedes.join(', ') : <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-2">
                  {u.bloqueado ? <Badge tone="danger">Bloqueado</Badge> : <Badge tone={u.activo ? 'ok' : 'neutral'}>{u.activo ? 'Activo' : 'Desactivado'}</Badge>}
                  {u.debe_cambiar_password && <span className="ml-1"><Badge tone="warn">Contraseña temporal</Badge></span>}
                </td>
                <td className="space-x-3 px-4 py-2 text-right whitespace-nowrap">
                  <button type="button" className="font-semibold text-cuc-blue hover:underline" onClick={() => startEdit(u)}>Editar</button>
                  {u.id !== me && (
                    <button type="button" className="font-semibold text-slate-600 hover:underline" onClick={() => void setActive(u, !u.activo)}>
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
