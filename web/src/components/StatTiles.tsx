import { useMemo } from 'react'
import type { FanShot } from './RangeFan'

interface Props {
  shots: FanShot[]
}

interface Tile {
  key: string
  label: string
  value: string
  unit?: string
}

function avg(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

export function StatTiles({ shots }: Props) {
  const tiles = useMemo<Tile[]>(() => {
    const carries = shots.map((s) => s.carry).filter((v): v is number => v !== null)
    const smashes = shots.map((s) => s.smash_factor).filter((v): v is number => v !== null)
    const totals = shots.map((s) => s.total_distance).filter((v): v is number => v !== null)
    const ballSpeeds = shots.map((s) => s.ball_speed).filter((v): v is number => v !== null)
    const sessions = new Set(shots.map((s) => s.training_session_id)).size
    const avgCarry = avg(carries)
    const avgSmash = avg(smashes)
    const avgBall = avg(ballSpeeds)

    return [
      { key: 'shots', label: 'Shots', value: String(shots.length) },
      { key: 'sessions', label: 'Sessions', value: String(sessions) },
      { key: 'avg-carry', label: 'Avg carry', value: avgCarry === null ? '–' : avgCarry.toFixed(1), unit: 'm' },
      { key: 'best-total', label: 'Longest total', value: totals.length ? Math.max(...totals).toFixed(1) : '–', unit: 'm' },
      { key: 'avg-ball-speed', label: 'Avg ball speed', value: avgBall === null ? '–' : String(Math.round(avgBall * 3.6)), unit: 'km/h' },
      { key: 'avg-smash', label: 'Avg smash', value: avgSmash === null ? '–' : avgSmash.toFixed(2) },
    ]
  }, [shots])

  return (
    <div className="stat-tiles" data-testid="stat-tiles">
      {tiles.map((t) => (
        <div className="stat-tile" key={t.key} data-testid={`stat-${t.key}`}>
          <div className="label">{t.label}</div>
          <div className="value">
            <span data-testid="stat-value">{t.value}</span>
            {t.unit && <span className="unit">{t.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
