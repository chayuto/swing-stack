import { useMemo, useState } from 'react'
import type { Shot } from '../api/types'
import type { Mode } from '../theme'
import { hexToRgba, INK } from '../theme'

// Top-down driving range view. Equal metres-per-pixel on both axes, so
// the distance arcs are true circles around the tee. SVG rather than a
// chart library: the fan geometry (arcs, tee, sigma ellipses) is easier
// to own directly.

export interface FanShot extends Shot {
  color: string
  clubLabel: string
}

interface Props {
  shots: FanShot[]
  metric: 'carry' | 'total'
  mode: Mode
}

const W = 480
const H = 730
const M = { top: 30, bottom: 48, side: 18 }

interface Hover {
  shot: FanShot
  x: number
  y: number
}

function dist(shot: FanShot, metric: Props['metric']): number | null {
  return metric === 'carry' ? shot.carry : shot.total_distance
}

function side(shot: FanShot, metric: Props['metric']): number | null {
  return metric === 'carry' ? shot.carry_side : shot.total_side
}

function sideLabel(v: number): string {
  if (Math.abs(v) < 0.05) return '0.0 m'
  return `${Math.abs(v).toFixed(1)} m ${v < 0 ? 'L' : 'R'}`
}

const kmh = (mps: number) => Math.round(mps * 3.6)

export function RangeFan({ shots, metric, mode }: Props) {
  const ink = INK[mode]
  const [hover, setHover] = useState<Hover | null>(null)

  const plotted = useMemo(
    () => shots.filter((s) => dist(s, metric) !== null && side(s, metric) !== null),
    [shots, metric],
  )

  const geo = useMemo(() => {
    const maxDist = Math.max(100, Math.ceil((Math.max(0, ...plotted.map((s) => dist(s, metric)!)) * 1.06) / 25) * 25)
    const maxSide = Math.max(25, Math.ceil((Math.max(0, ...plotted.map((s) => Math.abs(side(s, metric)!))) * 1.2) / 5) * 5)
    const scale = Math.min((H - M.top - M.bottom) / maxDist, (W / 2 - M.side) / maxSide)
    const tee = { x: W / 2, y: H - M.bottom }
    const toXY = (s: FanShot) => ({ x: tee.x + side(s, metric)! * scale, y: tee.y - dist(s, metric)! * scale })
    return { maxDist, scale, tee, toXY }
  }, [plotted, metric])

  // Per-club 1-sigma dispersion ellipses (5+ shots). Unclassified
  // strokes (chips, mishits) get dots but no ellipse: they are not one
  // club, so their sigma is meaningless and the ellipse dwarfs the fan.
  const ellipses = useMemo(() => {
    const byClub = new Map<string, FanShot[]>()
    for (const s of plotted) {
      if (!s.club) continue
      byClub.set(s.club.id, [ ...(byClub.get(s.club.id) ?? []), s ])
    }
    return [ ...byClub.values() ]
      .filter((group) => group.length >= 5)
      .map((group) => {
        const xs = group.map((s) => side(s, metric)!)
        const ys = group.map((s) => dist(s, metric)!)
        const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
        const sd = (v: number[], m: number) =>
          Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1))
        const mx = mean(xs)
        const my = mean(ys)
        return { mx, my, sx: sd(xs, mx), sy: sd(ys, my), color: group[0].color }
      })
  }, [plotted, metric])

  const arcs = []
  for (let d = 25; d <= geo.maxDist; d += 25) arcs.push(d)

  return (
    <div className="fan-wrap" data-testid="range-fan">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Shot dispersion, ${plotted.length} shots`}>
        <defs>
          <clipPath id="fan-clip">
            <rect x={M.side} y={M.top - 14} width={W - 2 * M.side} height={H - M.top - M.bottom + 14} />
          </clipPath>
        </defs>

        <g clipPath="url(#fan-clip)">
          {arcs.map((d) => (
            <circle key={d} cx={geo.tee.x} cy={geo.tee.y} r={d * geo.scale} fill="none" stroke={ink.grid} strokeWidth={1} />
          ))}
          <line
            x1={geo.tee.x}
            y1={geo.tee.y}
            x2={geo.tee.x}
            y2={M.top - 14}
            stroke={ink.axis}
            strokeWidth={1}
            strokeDasharray="3 5"
          />
          {ellipses.map((e, i) => (
            <ellipse
              key={i}
              cx={geo.tee.x + e.mx * geo.scale}
              cy={geo.tee.y - e.my * geo.scale}
              rx={Math.max(e.sx * geo.scale, 4)}
              ry={Math.max(e.sy * geo.scale, 4)}
              fill={hexToRgba(e.color, 0.09)}
              stroke={hexToRgba(e.color, 0.55)}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          ))}
        </g>

        {arcs.map((d) => (
          <text
            key={d}
            x={geo.tee.x + 7}
            y={geo.tee.y - d * geo.scale - 4}
            fontSize={10.5}
            fill={ink.muted}
            stroke={ink.surface}
            strokeWidth={3}
            paintOrder="stroke"
          >
            {d}
          </text>
        ))}

        {/* tee */}
        <circle cx={geo.tee.x} cy={geo.tee.y} r={4} fill={ink.text2} />
        <text x={geo.tee.x} y={geo.tee.y + 24} fontSize={11} fill={ink.muted} textAnchor="middle">
          tee · metres {metric === 'carry' ? '(carry)' : '(total)'}
        </text>

        {plotted.map((s) => {
          const p = geo.toXY(s)
          const active = hover?.shot.id === s.id
          return (
            <circle
              key={s.id}
              className="fan-dot"
              data-testid="fan-dot"
              data-club={s.clubLabel}
              cx={p.x}
              cy={p.y}
              r={active ? 6.5 : 4.4}
              fill={s.color}
              stroke={ink.surface}
              strokeWidth={1.4}
              onMouseEnter={() => setHover({ shot: s, x: p.x, y: p.y })}
              onMouseLeave={() => setHover(null)}
            />
          )
        })}
      </svg>

      {hover && (
        <div
          className="viz-tooltip"
          data-testid="fan-tooltip"
          style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%` }}
        >
          <div className="head">
            <span className="dot" style={{ background: hover.shot.color }} />
            {hover.shot.clubLabel}
          </div>
          {hover.shot.carry !== null && (
            <div className="row"><span>Carry</span><b>{hover.shot.carry.toFixed(1)} m</b></div>
          )}
          {hover.shot.total_distance !== null && (
            <div className="row"><span>Total</span><b>{hover.shot.total_distance.toFixed(1)} m</b></div>
          )}
          {side(hover.shot, metric) !== null && (
            <div className="row"><span>Side</span><b>{sideLabel(side(hover.shot, metric)!)}</b></div>
          )}
          {hover.shot.ball_speed !== null && (
            <div className="row"><span>Ball speed</span><b>{kmh(hover.shot.ball_speed)} km/h</b></div>
          )}
          {hover.shot.spin_rate !== null && (
            <div className="row"><span>Spin</span><b>{Math.round(hover.shot.spin_rate).toLocaleString()} rpm</b></div>
          )}
          {hover.shot.max_height !== null && (
            <div className="row"><span>Apex</span><b>{hover.shot.max_height.toFixed(1)} m</b></div>
          )}
        </div>
      )}
    </div>
  )
}
