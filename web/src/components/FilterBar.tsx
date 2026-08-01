import { useEffect, useState } from 'react'
import type { TrainingSession } from '../api/types'

export interface ClubChip {
  key: string
  label: string
  color: string
  count: number
}

interface Props {
  sessions: TrainingSession[]
  sessionId: string
  onSessionChange: (id: string) => void
  chips: ClubChip[]
  activeClubs: Set<string> | null
  onToggleClub: (key: string) => void
  metric: 'carry' | 'total'
  onMetricChange: (m: 'carry' | 'total') => void
  grouping: 'club' | 'session'
  onGroupingChange: (g: 'club' | 'session') => void
  onOpen3D: () => void
  calibrated: boolean
  onToggleCalibrated: () => void
  onSetCalibration: (id: string, offsetDeg: number | null) => void
}

function sessionName(s: TrainingSession): string {
  const date = s.played_on
    ? new Date(`${s.played_on}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : s.external_id.slice(0, 8)
  return s.facility ? `${date} · ${s.facility}` : date
}

// Editor for the selected session's bay target-line correction. The
// value is stored on the session; telemetry itself is never rewritten.
function CalibrationEditor({
  session,
  onSetCalibration,
}: {
  session: TrainingSession
  onSetCalibration: (id: string, offsetDeg: number | null) => void
}) {
  const stored = session.calibration_offset_deg
  const [draft, setDraft] = useState(stored?.toString() ?? '')
  useEffect(() => setDraft(stored?.toString() ?? ''), [session.id, stored])

  const parsed = draft.trim() === '' ? null : Number(draft)
  const valid = parsed === null || (Number.isFinite(parsed) && Math.abs(parsed) <= 15)
  const dirty = parsed !== stored && !(parsed === null && stored === null)

  return (
    <span className="calibration-editor">
      <label htmlFor="calibration-offset">Bay offset°</label>
      <input
        id="calibration-offset"
        data-testid="calibration-offset-input"
        type="number"
        step="0.1"
        min="-15"
        max="15"
        placeholder="none"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button
        className="ghost-btn"
        disabled={!valid || !dirty}
        onClick={() => onSetCalibration(session.id, parsed)}
      >
        Save
      </button>
    </span>
  )
}

export function FilterBar({
  sessions,
  sessionId,
  onSessionChange,
  chips,
  activeClubs,
  onToggleClub,
  metric,
  onMetricChange,
  grouping,
  onGroupingChange,
  onOpen3D,
  calibrated,
  onToggleCalibrated,
  onSetCalibration,
}: Props) {
  const selected = sessions.find((s) => s.id === sessionId)
  return (
    <div className="filter-bar" data-testid="filter-bar">
      <select
        aria-label="Session"
        data-testid="filter-session"
        value={sessionId}
        onChange={(e) => onSessionChange(e.target.value)}
      >
        <option value="all">All sessions ({sessions.length})</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {sessionName(s)} · {s.shots_count} shots
          </option>
        ))}
      </select>

      <div className="chip-row" role="group" aria-label="Clubs">
        {chips.map((chip) => (
          <button
            key={chip.key}
            className="chip"
            data-testid="filter-club"
            aria-pressed={activeClubs === null || activeClubs.has(chip.key)}
            onClick={() => onToggleClub(chip.key)}
          >
            <span className="dot" style={{ background: chip.color }} />
            {chip.label}
            <span className="count">{chip.count}</span>
          </button>
        ))}
      </div>

      <div className="segmented" role="group" aria-label="Distance metric">
        <button data-testid="metric-carry" aria-pressed={metric === 'carry'} onClick={() => onMetricChange('carry')}>
          Carry
        </button>
        <button data-testid="metric-total" aria-pressed={metric === 'total'} onClick={() => onMetricChange('total')}>
          Total
        </button>
      </div>

      <div className="segmented" role="group" aria-label="Colour dots by" title="Colour dots by club or by session date">
        <button data-testid="group-by-club" aria-pressed={grouping === 'club'} onClick={() => onGroupingChange('club')}>
          By club
        </button>
        <button
          data-testid="group-by-session"
          aria-pressed={grouping === 'session'}
          onClick={() => onGroupingChange('session')}
        >
          By session
        </button>
      </div>

      <button
        className="ghost-btn"
        data-testid="calibration-toggle"
        aria-pressed={calibrated}
        title="Correct direction metrics for each session's bay target-line offset"
        onClick={onToggleCalibrated}
      >
        Bay cal. {calibrated ? 'on' : 'off'}
      </button>

      {selected && <CalibrationEditor session={selected} onSetCalibration={onSetCalibration} />}

      <button className="ghost-btn open-3d" data-testid="open-3d" onClick={onOpen3D}>
        3D view
      </button>
    </div>
  )
}
