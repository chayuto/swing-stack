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

// Loads everything the dashboard needs and returns the next state.
// It never throws: auth and network failures become states too.
async function fetchDashboard(): Promise<DashboardState> {
  try {
    await ensureSession()
    const [sessions, clubs, stats, shots] = await Promise.all([
      api.sessions(),
      api.clubs(),
      api.clubStats(),
      api.shots(),
    ])
    return { phase: 'ready', data: { sessions, clubs, stats, shots } }
  } catch (err) {
    if (err instanceof AuthRequiredError) return { phase: 'login', error: null }
    return { phase: 'error', message: err instanceof Error ? err.message : String(err) }
  }
}

export function useDashboardData() {
  const [state, setState] = useState<DashboardState>({ phase: 'loading' })
  const [calibrated, setCalibrated] = useState(false)

  // A cancelled load must not touch state: StrictMode mounts the
  // effect twice, and the abandoned first fetch would otherwise land
  // late and overwrite edits made after the visible load finished.
  useEffect(() => {
    let cancelled = false
    void fetchDashboard().then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const submitLogin = useCallback(async (email: string, password: string) => {
    try {
      await login(email, password)
    } catch (err) {
      setState({ phase: 'login', error: err instanceof Error ? err.message : String(err) })
      return
    }
    setState({ phase: 'loading' })
    setState(await fetchDashboard())
  }, [])

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
  // Fetch outside the state updater: updaters must stay pure, and
  // StrictMode runs them twice.
  const toggleCalibrated = useCallback(() => {
    const next = !calibrated
    setCalibrated(next)
    refreshStats(next)
  }, [calibrated, refreshStats])

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
    calibrated,
    toggleCalibrated,
    setSessionCalibration,
  }
}
