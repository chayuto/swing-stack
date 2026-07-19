import { useCallback, useEffect, useState } from 'react'
import { api, AuthRequiredError, ensureSession, login, logout } from './api/client'
import type { Club, ClubStats, Shot, TrainingSession } from './api/types'

export interface DashboardData {
  sessions: TrainingSession[]
  clubs: Club[]
  stats: ClubStats[]
  shots: Shot[]
}

export type DashboardState =
  | { phase: 'loading' }
  | { phase: 'login'; error: string | null }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; data: DashboardData }

export function useDashboardData() {
  const [state, setState] = useState<DashboardState>({ phase: 'loading' })

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    try {
      await ensureSession()
      const [sessions, clubs, stats, shots] = await Promise.all([
        api.sessions(),
        api.clubs(),
        api.clubStats(),
        api.shots(),
      ])
      setState({ phase: 'ready', data: { sessions, clubs, stats, shots } })
    } catch (err) {
      if (err instanceof AuthRequiredError) setState({ phase: 'login', error: null })
      else setState({ phase: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const submitLogin = useCallback(
    async (email: string, password: string) => {
      try {
        await login(email, password)
        await load()
      } catch (err) {
        setState({ phase: 'login', error: err instanceof Error ? err.message : String(err) })
      }
    },
    [load],
  )

  const signOut = useCallback(() => {
    logout()
    setState({ phase: 'login', error: null })
  }, [])

  return { state, submitLogin, signOut, reload: load }
}
