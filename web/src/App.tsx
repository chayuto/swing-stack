import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { TrendCard } from './components/TrendCard'
import { SessionTrendsCard } from './components/SessionTrendsCard'
import { ClubTable } from './components/ClubTable'
import { LoginPanel } from './components/LoginPanel'
import { SessionLegend } from './components/SessionLegend'
import { toShotInput } from './api/toShotInput'
import { calibrateShot, offsetsBySession } from './calibration'
import { clubGlyph, clubSymbol, sessionSlots } from './sessionGroups'
import type { ShotInput } from 'golf-shot-viz'

// three.js only loads when someone opens the 3D view.
const ShotViz3D = lazy(() =>
  import('./components/ShotViz3D').then((m) => ({ default: m.ShotViz3D })),
)

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
  calibrated: boolean
  onToggleCalibrated: () => void
  onSetCalibration: (id: string, offsetDeg: number | null) => void
}

function Dashboard({
  data,
  mode,
  onToggleShot,
  calibrated,
  onToggleCalibrated,
  onSetCalibration,
}: DashboardProps) {
  const [sessionId, setSessionId] = useState('all')
  const [activeClubs, setActiveClubs] = useState<Set<string> | null>(null)
  const [metric, setMetric] = useState<'carry' | 'total'>('carry')
  const [grouping, setGrouping] = useState<'club' | 'session'>('club')
  const [hoverSessionId, setHoverSessionId] = useState<string | null>(null)
  const [viz3DOpen, setViz3DOpen] = useState(false)

  // Fixed slot assignment from the full club list (ordered by loft), so
  // colors follow the club and never change when filters do.
  const palette = useMemo(() => {
    const ordered = [ ...data.clubs ].sort(
      (a, b) => Number(a.static_loft_deg) - Number(b.static_loft_deg),
    )
    const slots = new Map(ordered.map((c, i) => [ c.id, i ]))
    const slotOf = (clubId: string | null) =>
      clubId !== null ? (slots.get(clubId) ?? null) : null
    const colorOf = (clubId: string | null) => slotColor(slotOf(clubId), mode)
    return { ordered, colorOf, slotOf }
  }, [data.clubs, mode])

  // Session grouping: ramp colours over every session, oldest to
  // newest, so progression reads as a colour sweep in the charts.
  const groupBySession = grouping === 'session'
  const slots = useMemo(() => sessionSlots(data.sessions, mode), [data.sessions, mode])

  // The calibration layer: pure math over the raw shots the API served.
  // Nothing is refetched when the toggle flips.
  const shots = useMemo(() => {
    if (!calibrated) return data.shots
    const offsets = offsetsBySession(data.sessions)
    return data.shots.map((s) => calibrateShot(s, offsets.get(s.training_session_id)))
  }, [calibrated, data.shots, data.sessions])

  const enriched = useMemo<FanShot[]>(
    () =>
      shots.map((s) => ({
        ...s,
        color: palette.colorOf(s.club?.id ?? null),
        clubLabel: s.club?.label ?? 'Unclassified',
      })),
    [shots, palette],
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

  // Session comparison is one club at a time: mixing Driver and 7 Iron
  // dots under session colours reads as noise. Switching to By session
  // narrows to the busiest club; switching back restores the previous
  // selection unless the user changed clubs in between.
  const savedClubs = useRef<{ prev: Set<string> | null; auto: Set<string> | null } | null>(null)
  const changeGrouping = useCallback(
    (g: 'club' | 'session') => {
      if (g === grouping) return
      if (g === 'session') {
        const busiest = chips.reduce<ClubChip | null>(
          (a, b) => (a === null || b.count > a.count ? b : a),
          null,
        )
        const auto = busiest && chips.length > 1 ? new Set([busiest.key]) : null
        savedClubs.current = { prev: activeClubs, auto }
        if (auto) setActiveClubs(auto)
      } else if (savedClubs.current) {
        const { prev, auto } = savedClubs.current
        const untouched =
          auto === null ||
          (activeClubs !== null &&
            activeClubs.size === auto.size &&
            [...auto].every((k) => activeClubs.has(k)))
        if (untouched) setActiveClubs(prev)
        savedClubs.current = null
      }
      setGrouping(g)
    },
    [grouping, chips, activeClubs],
  )

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

  // The trend card always spans all sessions (that is the point of a
  // trend), so it takes the club filter but not the session filter.
  const clubFiltered = useMemo(
    () =>
      enriched.filter(
        (s) => activeClubs === null || activeClubs.has(s.club?.id ?? UNCLASSIFIED_KEY),
      ),
    [enriched, activeClubs],
  )

  // Sessions present in the current filter, in ramp order, for the
  // interactive legends under the session-grouped charts.
  const visibleSlots = useMemo(() => {
    const ids = new Set(filtered.map((s) => s.training_session_id))
    return [...slots.values()].filter((s) => ids.has(s.id)).sort((a, b) => a.index - b.index)
  }, [filtered, slots])

  const clubGlyphs = useMemo(
    () =>
      chips
        .filter((c) => activeClubs === null || activeClubs.has(c.key))
        .map((c) => ({
          glyph: clubGlyph(c.key === UNCLASSIFIED_KEY ? null : palette.slotOf(c.key)),
          label: c.label,
        })),
    [chips, activeClubs, palette],
  )

  // Club symbols matter only when two clubs share a session-coloured
  // chart; a single club reads best as plain dots.
  const multiClub = clubGlyphs.length > 1
  const symbolOf = useCallback(
    (clubId: string | null) => (multiClub ? clubSymbol(palette.slotOf(clubId)) : 'circle'),
    [multiClub, palette],
  )

  // Excluded shots stay visible (hollow dots) so they can be restored,
  // but every stat and aggregate chart ignores them.
  const analyzed = useMemo(() => filtered.filter((s) => !s.excluded), [filtered])
  const excludedCount = filtered.length - analyzed.length

  // The 3D view takes the current filter selection with the same club
  // colors as the charts. golf-shot-viz is this project's own library.
  const shots3D = useMemo<ShotInput[]>(() => {
    const labels = new Map(data.sessions.map((s) => [s.id, s.played_on ?? s.external_id.slice(0, 8)]))
    return analyzed
      .map((s) => toShotInput(s, labels.get(s.training_session_id)))
      .filter((s): s is ShotInput => s !== null)
  }, [analyzed, data.sessions])

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
        grouping={grouping}
        onGroupingChange={changeGrouping}
        onOpen3D={() => setViz3DOpen(true)}
        calibrated={calibrated}
        onToggleCalibrated={onToggleCalibrated}
        onSetCalibration={onSetCalibration}
      />
      {viz3DOpen && (
        <Suspense fallback={<div className="viz3d-overlay panel-center">Loading 3D view…</div>}>
          <ShotViz3D shots={shots3D} onClose={() => setViz3DOpen(false)} />
        </Suspense>
      )}
      <StatTiles shots={analyzed} />
      <TrendCard
        shots={clubFiltered}
        sessions={data.sessions}
        selectedSessionId={sessionId}
        mode={mode}
        onToggle={onToggleShot}
      />
      <SessionTrendsCard
        shots={clubFiltered}
        sessions={data.sessions}
        selectedSessionId={sessionId}
        mode={mode}
      />
      <div className="dashboard-grid">
        <section className="card" aria-label="Shot dispersion">
          <h2>Dispersion</h2>
          <p className="subtitle">
            Top-down view from the tee. Dashed ellipses are 2σ of full swings per{' '}
            {groupBySession ? 'session. Hover a dot or a date to isolate a session.' : 'club.'}
            {calibrated && <span data-testid="calibrated-note"> Bay-calibrated view.</span>}
            {excludedCount > 0 && (
              <span className="excluded-note" data-testid="excluded-note">
                {' '}{excludedCount} excluded (hollow dots). Click one to restore it.
              </span>
            )}
          </p>
          <RangeFan
            shots={filtered}
            metric={metric}
            mode={mode}
            onToggle={onToggleShot}
            sessionSlots={groupBySession ? slots : null}
            hoverSessionId={hoverSessionId}
          />
          {groupBySession ? (
            <SessionLegend
              slots={visibleSlots}
              hovered={hoverSessionId}
              onHover={setHoverSessionId}
              testId="fan-session-legend"
            />
          ) : (
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
          )}
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
          {groupBySession &&
            ' Ellipses are 2σ of full swings per session, the dashed trail links session means. Hover a dot or a date to isolate a session.'}
          {calibrated && ' Bay-calibrated view.'}
        </p>
        <div className="shape-chart">
          <ShotShapeChart
            shots={filtered}
            mode={mode}
            onToggle={onToggleShot}
            sessionSlots={groupBySession ? slots : null}
            hoverSessionId={hoverSessionId}
            symbolOf={symbolOf}
          />
        </div>
        {groupBySession && (
          <SessionLegend
            slots={visibleSlots}
            hovered={hoverSessionId}
            onHover={setHoverSessionId}
            testId="shape-session-legend"
            extras={clubGlyphs.length > 1 ? clubGlyphs : undefined}
          />
        )}
      </section>
      <section className="card table-card" aria-label="Club averages">
        <h2>Club averages</h2>
        <p className="subtitle">
          All sessions, aggregated in PostgreSQL via /api/v1/stats/clubs.
          {calibrated && ' Bay-calibrated view.'}
        </p>
        <ClubTable stats={data.stats} colorOf={palette.colorOf} />
      </section>
    </>
  )
}

export default function App() {
  const [mode, themePref, cycleTheme] = useThemeMode()
  const { state, submitLogin, signOut, setExcluded, calibrated, toggleCalibrated, setSessionCalibration } =
    useDashboardData()

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
        <Dashboard
          data={state.data}
          mode={mode}
          onToggleShot={setExcluded}
          calibrated={calibrated}
          onToggleCalibrated={toggleCalibrated}
          onSetCalibration={setSessionCalibration}
        />
      )}

      <footer className="app-footer">
        Distances in metres, speeds in km/h, SI units in the API. Data ingested from TrackMan
        report exports via POST /api/v1/imports.
      </footer>
    </>
  )
}
