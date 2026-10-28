import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface AdminSession {
  token: string
  /** Epoch en ms. */
  expiresAt: number
  user: { id: string; nombre: string }
}

interface AdminState {
  session: AdminSession | null
  setSession: (session: AdminSession) => void
  clear: () => void
}

/** Sesión de administración: separada de la clínica y solo en sessionStorage. */
export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      clear: () => set({ session: null }),
    }),
    { name: 'healthai.admin-session', storage: createJSONStorage(() => sessionStorage) },
  ),
)

export const isAdminSessionValid = (s: AdminSession | null): s is AdminSession => s !== null && s.expiresAt > Date.now()
