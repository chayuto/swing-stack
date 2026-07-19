import { useCallback, useEffect, useMemo, useState } from 'react'
import { currentUser } from './api/client'
import type { Mode } from './theme'
import { slotColor } from './theme'
import { useDashboardData } from './useDashboardData'
import type { DashboardData } from './useDashboardData'
import { FilterBar } from './components/FilterBar'
import type { ClubChip } from './components/FilterBar'
import { StatTiles } from './components/StatTiles'
import { RangeFan } from './components/RangeFan'
import type { FanShot } from './components/RangeFan'
import { TrajectoryChart } from './components/TrajectoryChart'
import { GappingChart } from './components/GappingChart'
import { ShotShapeChart } from './components/ShotShapeChart'
import { ClubTable } from './components/ClubTable'
import { LoginPanel } from './components/LoginPanel'

type ThemePref = 'auto' | 'light' | 'dark'

function useThemeMode(): [Mode, ThemePref, () => void] {
  const [pref, setPref] = useState<ThemePref>(
    () => (localStorage.getItem('swing-stack.theme') as ThemePref) ?? 'auto',
  )
  const [osDark, setOsDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setOsDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (pref === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = pref
    localStorage.setItem('swing-stack.theme', pref)
  }, [pref])

  const cycle = useCallback(
    () => setPref((p) => (p === 'auto' ? 'light' : p === 'light' ? 'dark' : 'auto')),
    [],
  )
  const mode: Mode = pref === 'auto' ? (osDark ? 'dark' : 'light') : pref
  return [mode, pref, cycle]
}

const UNCLASSIFIED_KEY = 'unclassified'

interface DashboardProps {
  data: DashboardData
  mode: Mode
  onToggleShot: (id: string, excluded: boolean) => void
}

function Dashboard({ data, mode, onToggleShot }: DashboardProps) {
  const [sessionId, setSessionId] = useState('all')
  const [activeClubs, setActiveClubs] = useState<Set<string> | null>(null)
  const [metric, setMetric] = useState<'carry' | 'total'>('carry')

  // Fixed slot assignment from the full club list (ordered by loft), so
  // colors follow the club and never change when filters do.
  const palette = useMemo(() => {
    const ordered = [ ...data.clubs ].sort(
      (a, b) => Number(a.static_loft_deg) - Number(b.static_loft_deg),
    )
    const slots = new Map(ordered.map((c, i) => [ c.id, i ]))
    const colorOf = (clubId: string | null) =>
      slotColor(clubId !== null ? (slots.get(clubId) ?? null) : null, mode)
    return { ordered, colorOf }
  }, [data.clubs, mode])

  const enriched = useMemo<FanShot[]>(
    () =>
      data.shots.map((s) => ({
        ...s,
        color: palette.colorOf(s.club?.id ?? null),
        clubLabel: s.club?.label ?? 'Unclassified',
      })),
    [data.shots, palette],
  )

  const chips = useMemo<ClubChip[]>(() => {
    const inSession =
      sessionId === 'all' ? enriched : enriched.filter((s) => s.training_session_id === sessionId)
    const counts = new Map<string, number>()
    for (const s of inSession) {
      const key = s.club?.id ?? UNCLASSIFIED_KEY
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const entries: ClubChip[] = palette.ordered
      .filter((c) => counts.has(c.id))
      .map((c) => ({
        key: c.id,
        label: c.label,
        color: palette.colorOf(c.id),
        count: counts.get(c.id)!,
      }))
    if (counts.has(UNCLASSIFIED_KEY)) {
      entries.push({
        key: UNCLASSIFIED_KEY,
        label: 'Unclassified',
        color: palette.colorOf(null),
        count: counts.get(UNCLASSIFIED_KEY)!,
      })
    }
    return entries
  }, [enriched, palette, sessionId])

  const toggleClub = useCallback(
    (key: string) => {
      setActiveClubs((prev) => {
        const all = new Set(chips.map((c) => c.key))
        const next = new Set(prev ?? all)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next.size === 0 || next.size === all.size ? null : next
      })
    },
    [chips],
  )

  const filtered = useMemo(
    () =>
      enriched.filter((s) => {
        if (sessionId !== 'all' && s.training_session_id !== sessionId) return false
        if (activeClubs === null) return true
        return activeClubs.has(s.club?.id ?? UNCLASSIFIED_KEY)
      }),
    [enriched, sessionId, activeClubs],
  )

  // Excluded shots stay visible (hollow dots) so they can be restored,
  // but every stat and aggregate chart ignores them.
  const analyzed = useMemo(() => filtered.filter((s) => !s.excluded), [filtered])
  const excludedCount = filtered.length - analyzed.length

  return (
    <>
      <FilterBar
        sessions={data.sessions}
        sessionId={sessionId}
        onSessionChange={setSessionId}
        chips={chips}
        activeClubs={activeClubs}
        onToggleClub={toggleClub}
        metric={metric}
        onMetricChange={setMetric}
      />
      <StatTiles shots={analyzed} />
      <div className="dashboard-grid">
        <section className="card" aria-label="Shot dispersion">
          <h2>Dispersion</h2>
          <p className="subtitle">
            Top-down view from the tee. Dashed ellipses are 1σ per club.
            {excludedCount > 0 && (
              <span className="excluded-note" data-testid="excluded-note">
                {' '}{excludedCount} excluded (hollow dots). Click one to restore it.
              </span>
            )}
          </p>
          <RangeFan shots={filtered} metric={metric} mode={mode} onToggle={onToggleShot} />
          <div className="fan-legend" data-testid="fan-legend">
            {chips
              .filter((c) => activeClubs === null || activeClubs.has(c.key))
              .map((c) => (
                <span className="entry" key={c.key}>
                  <span className="dot" style={{ background: c.color }} />
                  {c.label}
                </span>
              ))}
          </div>
        </section>
        <div className="right-col">
          <section className="card" aria-label="Ball flight">
            <h2>Ball flight</h2>
            <p className="subtitle">Side view of every recorded trajectory. Hover to isolate a shot.</p>
            <TrajectoryChart shots={analyzed} mode={mode} />
          </section>
          <section className="card" aria-label="Carry gapping">
            <h2>Gapping</h2>
            <p className="subtitle">Carry per club: every shot, mean, and ±1σ band.</p>
            <GappingChart shots={analyzed} mode={mode} />
          </section>
        </div>
      </div>
      <section className="card shape-card" aria-label="Shot shape">
        <h2>Shot shape</h2>
        <p className="subtitle">
          Face angle vs club path at impact. Click a dot to exclude a mishit from every stat.
        </p>
        <div className="shape-chart">
          <ShotShapeChart shots={filtered} mode={mode} onToggle={onToggleShot} />
        </div>
      </section>
      <section className="card table-card" aria-label="Club averages">
        <h2>Club averages</h2>
        <p className="subtitle">All sessions, aggregated in PostgreSQL via /api/v1/stats/clubs.</p>
        <ClubTable stats={data.stats} colorOf={palette.colorOf} />
      </section>
    </>
  )
}

export default function App() {
  const [mode, themePref, cycleTheme] = useThemeMode()
  const { state, submitLogin, signOut, setExcluded } = useDashboardData()

  return (
    <>
      <header className="app-header">
        <div className="wordmark">
          <h1>
            Swing<span className="tick">·</span>Stack
          </h1>
          <span className="tagline">launch monitor telemetry</span>
        </div>
        <div className="header-actions">
          {state.phase === 'ready' && (
            <>
              <span className="who" data-testid="session-user">{currentUser()?.email}</span>
              <button className="ghost-btn" data-testid="sign-out" onClick={signOut}>
                Sign out
              </button>
            </>
          )}
          <button
            className="icon-btn"
            data-testid="theme-toggle"
            onClick={cycleTheme}
            title={`Theme: ${themePref}`}
            aria-label={`Theme: ${themePref}. Click to change.`}
          >
            {themePref === 'auto' ? 'Auto' : themePref === 'light' ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>

      {state.phase === 'loading' && (
        <div className="panel-center" data-testid="loading">
          <span>Loading telemetry…</span>
        </div>
      )}
      {state.phase === 'login' && <LoginPanel error={state.error} onSubmit={submitLogin} />}
      {state.phase === 'error' && (
        <div className="panel-center" role="alert" data-testid="load-error">
          <span>Could not load telemetry: {state.message}</span>
        </div>
      )}
      {state.phase === 'ready' && (
        <Dashboard data={state.data} mode={mode} onToggleShot={setExcluded} />
      )}

      <footer className="app-footer">
        Distances in metres, speeds in km/h, SI units in the API. Data ingested from TrackMan
        report exports via POST /api/v1/imports.
      </footer>
    </>
  )
}
