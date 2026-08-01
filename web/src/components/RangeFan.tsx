import { useMemo, useState } from 'react'
import type { Shot } from '../api/types'
import type { Mode } from '../theme'
import { hexToRgba, INK } from '../theme'
import type { SessionSlot } from '../sessionGroups'
import { covEllipse, ellipsePoints, fullSwings, GROUP_MIN } from '../sessionGroups'

// Top-down driving range view. Equal metres-per-pixel on both axes, so
// the distance arcs are true circles around the tee. SVG rather than a
// chart library: the fan geometry (arcs, tee, sigma ellipses) is easier
// to own directly.
//
// With session grouping on, dots and ellipses take the session ramp
// colour, ellipses split per session-club group, and hovering a dot or
// a legend entry dims every other session.

export interface FanShot extends Shot {
  color: string
  clubLabel: string
}

interface Props {
  shots: FanShot[]
  metric: 'carry' | 'total'
  mode: Mode
  onToggle: (id: string, excluded: boolean) => void
  /** Session ramp slots; null renders the classic by-club view */
  sessionSlots: Map<string, SessionSlot> | null
  hoverSessionId: string | null
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

export function RangeFan({ shots, metric, mode, onToggle, sessionSlots, hoverSessionId }: Props) {
  const ink = INK[mode]
  const [hover, setHover] = useState<Hover | null>(null)

  // Session to isolate: the legend hover wins, then a hovered dot's own
  // session. Only meaningful with session grouping on.
  const hlSession = sessionSlots
    ? (hoverSessionId ?? hover?.shot.training_session_id ?? null)
    : null
  const colorOf = (s: FanShot) =>
    sessionSlots ? (sessionSlots.get(s.training_session_id)?.color ?? s.color) : s.color

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

  // 1-sigma dispersion ellipses (GROUP_MIN+ shots): per club, or per
  // session-club group when session grouping is on. Unclassified
  // strokes (chips, mishits) get dots but no ellipse: they are not one
  // club, so their sigma is meaningless and the ellipse dwarfs the fan.
  const ellipses = useMemo(() => {
    const groups = new Map<string, FanShot[]>()
    for (const s of plotted) {
      if (!s.club || s.excluded) continue
      const key = sessionSlots ? `${s.training_session_id}:${s.club.id}` : s.club.id
      groups.set(key, [ ...(groups.get(key) ?? []), s ])
    }
    return [ ...groups.values() ]
      // Fit on full swings only: drills and chips keep their dots but
      // would smear the ellipse across half the range.
      .map((group) => fullSwings(group, (s) => dist(s, metric)))
      .filter((group) => group.length >= GROUP_MIN)
      .map((group) => ({
        ellipse: covEllipse(
          group.map((s) => side(s, metric)!),
          group.map((s) => dist(s, metric)!),
          2,
          2,
        ),
        color: sessionSlots
          ? (sessionSlots.get(group[0].training_session_id)?.color ?? group[0].color)
          : group[0].color,
        sessionId: sessionSlots ? group[0].training_session_id : null,
      }))
  }, [plotted, metric, sessionSlots])

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
          {ellipses.map((e, i) => {
            const dim = hlSession !== null && e.sessionId !== hlSession
            const focus = hlSession !== null && e.sessionId === hlSession
            const points = ellipsePoints(e.ellipse)
              .map(([x, y]) => `${(geo.tee.x + x * geo.scale).toFixed(1)},${(geo.tee.y - y * geo.scale).toFixed(1)}`)
              .join(' ')
            return (
              <polygon
                key={i}
                points={points}
                fill={hexToRgba(e.color, dim ? 0.02 : focus ? 0.13 : 0.09)}
                stroke={hexToRgba(e.color, dim ? 0.12 : focus ? 0.85 : 0.55)}
                strokeWidth={focus ? 1.8 : 1}
                strokeDasharray="4 4"
                strokeLinejoin="round"
              />
            )
          })}
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
          const dim = hlSession !== null && s.training_session_id !== hlSession
          const fill = colorOf(s)
          return (
            <circle
              key={s.id}
              className="fan-dot"
              data-testid="fan-dot"
              data-club={s.clubLabel}
              data-excluded={s.excluded || undefined}
              cx={p.x}
              cy={p.y}
              r={active ? 6.5 : 4.4}
              fill={s.excluded ? ink.surface : fill}
              stroke={s.excluded ? fill : ink.surface}
              strokeWidth={1.4}
              opacity={dim ? 0.12 : s.excluded ? 0.55 : 1}
              onMouseEnter={() => setHover({ shot: s, x: p.x, y: p.y })}
              onMouseLeave={() => setHover(null)}
              onClick={() => onToggle(s.id, !s.excluded)}
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
            <span className="dot" style={{ background: colorOf(hover.shot) }} />
            {hover.shot.clubLabel}
            {sessionSlots?.get(hover.shot.training_session_id) && (
              <> · {sessionSlots.get(hover.shot.training_session_id)!.label}</>
            )}
            {hover.shot.excluded && <span className="flag"> excluded</span>}
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
          <div className="hint">click to {hover.shot.excluded ? 'restore' : 'exclude'}</div>
        </div>
      )}
    </div>
  )
}
