import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSessionValid, useAuthStore } from './authStore'

/** Cierra la sesión al expirar y devuelve los minutos restantes (para avisar). */
export function useSessionExpiry(): number | null {
  const session = useAuthStore((s) => s.session)
  const clear = useAuthStore((s) => s.clear)
  const navigate = useNavigate()
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!isSessionValid(session)) return
    const tick = () => {
      const left = session.expiresAt - Date.now()
      if (left <= 0) {
        clear()
        navigate('/login', { replace: true, state: { expired: true } })
      } else {
        setMinutesLeft(Math.ceil(left / 60000))
      }
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [session, clear, navigate])

  return isSessionValid(session) ? minutesLeft : null
}
