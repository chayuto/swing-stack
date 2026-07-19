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
  onOpen3D: () => void
}

function sessionName(s: TrainingSession): string {
  const date = s.played_on
    ? new Date(`${s.played_on}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : s.external_id.slice(0, 8)
  return s.facility ? `${date} · ${s.facility}` : date
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
  onOpen3D,
}: Props) {
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

      <button className="ghost-btn open-3d" data-testid="open-3d" onClick={onOpen3D}>
        3D view
      </button>
    </div>
  )
}
