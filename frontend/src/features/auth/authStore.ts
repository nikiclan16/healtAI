import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Session } from '@/services/types'

interface AuthState {
  session: Session | null
  setSession: (session: Session) => void
  /** Tras cambiar la contraseña temporal, el servidor ya permite operar. */
  passwordChanged: () => void
  clear: () => void
}

/** La sesión vive solo en sessionStorage: se pierde al cerrar la pestaña. */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      passwordChanged: () =>
        set((s) => (s.session ? { session: { ...s.session, debeCambiarPassword: false } } : s)),
      clear: () => set({ session: null }),
    }),
    { name: 'healthai.session', storage: createJSONStorage(() => sessionStorage) },
  ),
)

export const isSessionValid = (session: Session | null): session is Session =>
  session !== null && session.expiresAt > Date.now()
