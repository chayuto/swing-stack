import type { ClubStats } from '../api/types'

// All-time per-club aggregates straight from GET /stats/clubs (computed
// in PostgreSQL). Doubles as the accessible table view of the charts.

interface Props {
  stats: ClubStats[]
  colorOf: (clubId: string | null) => string
}

const fmt = (v: number | null, digits = 1, suffix = '') => (v === null ? '–' : `${v.toFixed(digits)}${suffix}`)
const kmh = (v: number | null) => (v === null ? '–' : `${Math.round(v * 3.6)}`)

export function ClubTable({ stats, colorOf }: Props) {
  const rows = [ ...stats ].sort(
    (a, b) => Number(b.club.static_loft_deg) - Number(a.club.static_loft_deg),
  )

  return (
    <table className="club-table" data-testid="club-table">
      <thead>
        <tr>
          <th scope="col">Club</th>
          <th scope="col">Loft</th>
          <th scope="col">Shots</th>
          <th scope="col">Carry</th>
          <th scope="col">Carry SD</th>
          <th scope="col">Side SD</th>
          <th scope="col">Total</th>
          <th scope="col">Ball km/h</th>
          <th scope="col">Club km/h</th>
          <th scope="col">Smash</th>
          <th scope="col">Spin rpm</th>
          <th scope="col">Apex</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.club.id} data-testid="club-row">
            <td>
              <span className="club-name">
                <span className="dot" style={{ background: colorOf(r.club.id) }} />
                {r.club.label}
              </span>
            </td>
            <td>{Number(r.club.static_loft_deg).toFixed(1)}°</td>
            <td>{r.shots_count}</td>
            <td>{fmt(r.averages.carry, 1, ' m')}</td>
            <td>{fmt(r.dispersion.carry_sd, 1, ' m')}</td>
            <td>{fmt(r.dispersion.side_sd, 1, ' m')}</td>
            <td>{fmt(r.averages.total_distance, 1, ' m')}</td>
            <td>{kmh(r.averages.ball_speed)}</td>
            <td>{kmh(r.averages.club_speed)}</td>
            <td>{fmt(r.averages.smash_factor, 2)}</td>
            <td>{r.averages.spin_rate === null ? '–' : Math.round(r.averages.spin_rate).toLocaleString()}</td>
            <td>{fmt(r.averages.max_height, 1, ' m')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
