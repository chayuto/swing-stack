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
  const [calibrated, setCalibrated] = useState(false)

  // A cancelled load must not touch state: StrictMode mounts the
  // effect twice, and the abandoned first fetch would otherwise land
  // late and overwrite edits made after the visible load finished.
  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setState({ phase: 'loading' })
    try {
      await ensureSession()
      const [sessions, clubs, stats, shots] = await Promise.all([
        api.sessions(),
        api.clubs(),
        api.clubStats(),
        api.shots(),
      ])
      if (signal?.cancelled) return
      setState({ phase: 'ready', data: { sessions, clubs, stats, shots } })
    } catch (err) {
      if (signal?.cancelled) return
      if (err instanceof AuthRequiredError) setState({ phase: 'login', error: null })
      else setState({ phase: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
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

  // Optimistic: flip the flag locally, persist, then refresh the club
  // aggregates (the server recomputes them without excluded shots).
  const setExcluded = useCallback((id: string, excluded: boolean) => {
    const patch = (value: boolean) =>
      setState((prev) =>
        prev.phase === 'ready'
          ? {
              ...prev,
              data: {
                ...prev.data,
                shots: prev.data.shots.map((s) => (s.id === id ? { ...s, excluded: value } : s)),
              },
            }
          : prev,
      )
    patch(excluded)
    void api.setShotExcluded(id, excluded).then(
      // Stats refresh is best effort: the flag is already persisted, so
      // a failed refetch must not revert the dot.
      async () => {
        try {
          const stats = await api.clubStats(calibrated)
          setState((prev) =>
            prev.phase === 'ready' ? { ...prev, data: { ...prev.data, stats } } : prev,
          )
        } catch {
          /* keep the previous aggregates */
        }
      },
      () => patch(!excluded),
    )
  }, [calibrated])

  const refreshStats = useCallback((useCalibrated: boolean) => {
    void api.clubStats(useCalibrated).then((stats) =>
      setState((prev) =>
        prev.phase === 'ready' ? { ...prev, data: { ...prev.data, stats } } : prev,
      ),
    )
  }, [])

  // The toggle never refetches shots: per-shot correction is pure math
  // done client-side. Only the SQL club aggregates need a round trip.
  const toggleCalibrated = useCallback(() => {
    setCalibrated((prev) => {
      refreshStats(!prev)
      return !prev
    })
  }, [refreshStats])

  const setSessionCalibration = useCallback(
    async (id: string, offsetDeg: number | null) => {
      const updated = await api.setSessionCalibration(id, offsetDeg)
      setState((prev) =>
        prev.phase === 'ready'
          ? {
              ...prev,
              data: {
                ...prev.data,
                sessions: prev.data.sessions.map((s) =>
                  s.id === id
                    ? { ...s, calibration_offset_deg: updated.calibration_offset_deg }
                    : s,
                ),
              },
            }
          : prev,
      )
      refreshStats(calibrated)
    },
    [calibrated, refreshStats],
  )

  return {
    state,
    submitLogin,
    signOut,
    setExcluded,
    reload: load,
    calibrated,
    toggleCalibrated,
    setSessionCalibration,
  }
}
