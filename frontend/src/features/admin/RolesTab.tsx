import { useState } from 'react'
import { Badge, Field, Icon, btnPrimary, btnSecondary, inputClass } from '@/components/ui'
import { adminApi } from './adminApi'
import type { AdminRole, PerfilCargo } from './adminApi'
import { PERFIL_LABEL, slugifyCode } from './helpers'

/** Roles operativos: los que el personal elige en el portal de acceso. Cada uno hereda un perfil base. */
export function RolesTab({ roles, onChanged }: { roles: AdminRole[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [perfil, setPerfil] = useState<PerfilCargo>('evaluador')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const created = await adminApi.createRole({ label: label.trim(), rol: perfil })
      setNotice(`Rol "${created.label}" creado (código ${created.code}). Ya aparece en el portal de acceso.`)
      setLabel('')
      setOpen(false)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el rol')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(role: AdminRole) {
    setError(null)
    setNotice(null)
    try {
      await adminApi.patchRole(role.code, { activo: !role.activo })
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el rol')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-xs text-slate-500">
          Un rol operativo es el cargo con el que el personal ingresa (Médico, Psicólogo…). Hereda un <strong>perfil base</strong>: <em>Evaluador</em> registra evaluaciones; <em>Investigador</em> accede a métricas y auditoría.
        </p>
        <button type="button" className={btnPrimary} onClick={() => { setOpen((v) => !v); setError(null) }}>
          <Icon name="plus" /> Nuevo rol
        </button>
      </div>

      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>}

      {open && (
        <form onSubmit={create} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-bold text-slate-800">Nuevo rol operativo</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Nombre del rol" hint="Entre 3 y 60 caracteres">
              <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} required minLength={3} maxLength={60} placeholder="Ej. Trabajo Social" />
            </Field>
            <Field label="Perfil base">
              <select className={`${inputClass} cursor-pointer`} value={perfil} onChange={(e) => setPerfil(e.target.value as PerfilCargo)}>
                <option value="evaluador">Evaluador (profesional de la salud)</option>
                <option value="investigador">Investigador</option>
              </select>
            </Field>
            <Field label="Código (automático)" hint="Identificador interno; no se puede cambiar">
              <input className={`${inputClass} font-mono`} value={label.trim().length >= 3 ? slugifyCode(label) : ''} readOnly tabIndex={-1} />
            </Field>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={btnPrimary} disabled={busy || label.trim().length < 3}>{busy ? 'Creando…' : 'Crear rol'}</button>
            <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2">Rol</th>
              <th className="px-4">Código</th>
              <th className="px-4">Perfil base</th>
              <th className="px-4">Usuarios</th>
              <th className="px-4">Estado</th>
              <th className="px-4" />
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.code} className="border-t border-slate-100">
                <td className="px-4 py-2 font-semibold text-slate-800">{r.label}</td>
                <td className="px-4 font-mono text-slate-500">{r.code}</td>
                <td className="px-4">{PERFIL_LABEL[r.rol]}</td>
                <td className="px-4">{r.usuarios}</td>
                <td className="px-4"><Badge tone={r.activo ? 'ok' : 'neutral'}>{r.activo ? 'Activo' : 'Desactivado'}</Badge></td>
                <td className="px-4 text-right">
                  <button type="button" className="font-semibold text-cuc-blue hover:underline" onClick={() => void toggle(r)}>
                    {r.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
