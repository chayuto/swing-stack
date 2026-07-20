import { useMemo, useState } from 'react'
import type { EChartsCoreOption } from 'echarts/core'
import type { TrainingSession } from '../api/types'
import type { Mode } from '../theme'
import { hexToRgba, INK } from '../theme'
import type { FanShot } from './RangeFan'
import type { ChartClick } from './EChart'
import { EChart } from './EChart'

// Progress over time: every shot in chronological order, one selectable
// metric, a rolling average per club, and session bands. Built for the
// "my coach told me to work on face angle" loop: is the average moving
// toward the reference, and is the spread tightening?

interface Metric {
  key: keyof FanShot & string
  label: string
  group: 'Impact' | 'Ball flight' | 'Speed'
  unit: '°' | 'm' | 'km/h' | 'rpm' | ''
  /** m/s to km/h for speeds */
  scale?: number
  decimals: number
  axisName: string
  /** Reference line at zero, labelled with this word */
  zeroWord?: string
  /** [negative word, positive word] for readouts and tooltips */
  polarity?: [string, string]
  hint: string
}

const METRICS: Metric[] = [
  {
    key: 'face_angle', label: 'Face angle', group: 'Impact', unit: '°', decimals: 1,
    axisName: 'face angle (° open)', zeroWord: 'square', polarity: ['closed', 'open'],
    hint: 'Where the clubface points at impact. Sets the start line. Work toward square, then tighten the spread.',
  },
  {
    key: 'face_to_path', label: 'Face to path', group: 'Impact', unit: '°', decimals: 1,
    axisName: 'face to path (° open)', zeroWord: 'neutral', polarity: ['closed', 'open'],
    hint: 'Face angle minus club path. This gap is what curves the ball.',
  },
  {
    key: 'club_path', label: 'Club path', group: 'Impact', unit: '°', decimals: 1,
    axisName: 'club path (° in-to-out)', zeroWord: 'neutral', polarity: ['out-to-in', 'in-to-out'],
    hint: 'Swing direction through impact. Positive is in-to-out.',
  },
  {
    key: 'attack_angle', label: 'Attack angle', group: 'Impact', unit: '°', decimals: 1,
    axisName: 'attack angle (° up)', zeroWord: 'level', polarity: ['down', 'up'],
    hint: 'Strike direction at the ball. Down on irons, up on driver.',
  },
  {
    key: 'carry', label: 'Carry', group: 'Ball flight', unit: 'm', decimals: 1,
    axisName: 'carry (m)',
    hint: 'Airborne distance. Watch the average climb and the spread tighten.',
  },
  {
    key: 'total_side', label: 'Side', group: 'Ball flight', unit: 'm', decimals: 1,
    axisName: 'side (m right)', zeroWord: 'target line', polarity: ['left', 'right'],
    hint: 'Finish position left or right of the target line.',
  },
  {
    key: 'launch_angle', label: 'Launch angle', group: 'Ball flight', unit: '°', decimals: 1,
    axisName: 'launch angle (°)',
    hint: 'Angle the ball takes off at.',
  },
  {
    key: 'spin_rate', label: 'Spin rate', group: 'Ball flight', unit: 'rpm', decimals: 0,
    axisName: 'spin (rpm)',
    hint: 'Backspin. Steady spin means steady strikes.',
  },
  {
    key: 'smash_factor', label: 'Smash factor', group: 'Speed', unit: '', decimals: 2,
    axisName: 'smash factor',
    hint: 'Ball speed per club speed. Centered strikes score higher.',
  },
  {
    key: 'ball_speed', label: 'Ball speed', group: 'Speed', unit: 'km/h', scale: 3.6, decimals: 1,
    axisName: 'ball speed (km/h)',
    hint: 'Speed of the ball off the face.',
  },
  {
    key: 'club_speed', label: 'Club speed', group: 'Speed', unit: 'km/h', scale: 3.6, decimals: 1,
    axisName: 'club speed (km/h)',
    hint: 'Clubhead speed at impact.',
  },
]

const GROUPS: Metric['group'][] = ['Impact', 'Ball flight', 'Speed']

// Rolling window per club. Trailing, so the line answers "where are my
// last ten swings with this club trending".
const WINDOW = 10
const MIN_SAMPLES = 3
// A rolling line needs enough shots to mean something. Sparse clubs
// keep their dots but draw no line.
const LINE_MIN = WINDOW

function fmtNum(v: number, m: Metric): string {
  const n = v.toFixed(m.decimals)
  if (m.unit === '°') return `${n}°`
  return m.unit ? `${n} ${m.unit}` : n
}

function fmtValue(v: number, m: Metric): string {
  if (!m.polarity) return fmtNum(v, m)
  if (Math.abs(v) < 0.05) return `${fmtNum(0, m)} ${m.zeroWord ?? ''}`.trim()
  return `${fmtNum(Math.abs(v), m)} ${v > 0 ? m.polarity[1] : m.polarity[0]}`
}

function deltaText(latest: number, earlier: number, m: Metric): string {
  if (m.zeroWord) {
    const d = Math.abs(earlier) - Math.abs(latest)
    if (Math.abs(d) < 0.05) return 'no change'
    const dir = d > 0 ? 'closer to' : 'further from'
    return `${fmtNum(Math.abs(d), m)} ${dir} ${m.zeroWord}`
  }
  const d = latest - earlier
  if (Math.abs(d) < 0.5 * 10 ** -m.decimals) return 'no change'
  return `${d > 0 ? '+' : '-'}${fmtNum(Math.abs(d), m)}`
}

function meanSd(values: number[]): { mean: number; sd: number } {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sd =
    values.length > 1
      ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1))
      : 0
  return { mean, sd }
}

interface SeqShot {
  x: number
  v: number
  shot: FanShot
  sessionIdx: number
  dateLabel: string
}

interface TrendDot {
  value: [number, number]
  shotId: string
  excluded: boolean
  clubLabel: string
  dateLabel: string
}

interface Props {
  /** Club-filtered shots, all sessions, excluded ones included */
  shots: FanShot[]
  sessions: TrainingSession[]
  selectedSessionId: string
  mode: Mode
  onToggle: (id: string, excluded: boolean) => void
}

export function TrendCard({ shots, sessions, selectedSessionId, mode, onToggle }: Props) {
  const ink = INK[mode]
  const [metricKey, setMetricKey] = useState<string>('face_angle')
  const metric = METRICS.find((m) => m.key === metricKey)!

  const model = useMemo(() => {
    const ordered = [...sessions].sort((a, b) =>
      (a.played_on ?? a.created_at).localeCompare(b.played_on ?? b.created_at),
    )
    const sessionMeta = new Map(
      ordered.map((s, idx) => {
        const iso = s.played_on ? `${s.played_on}T00:00:00` : s.created_at
        const dateLabel = new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
        return [s.id, { idx, dateLabel }]
      }),
    )

    const seq: SeqShot[] = shots
      .filter((s) => s[metric.key] !== null && sessionMeta.has(s.training_session_id))
      .sort((a, b) => {
        const sa = sessionMeta.get(a.training_session_id)!.idx
        const sb = sessionMeta.get(b.training_session_id)!.idx
        if (sa !== sb) return sa - sb
        return (a.struck_at ?? a.external_id).localeCompare(b.struck_at ?? b.external_id)
      })
      .map((shot, x) => {
        const meta = sessionMeta.get(shot.training_session_id)!
        return {
          x,
          v: (shot[metric.key] as number) * (metric.scale ?? 1),
          shot,
          sessionIdx: meta.idx,
          dateLabel: meta.dateLabel,
        }
      })

    // Contiguous x-ranges per session, for the alternating background bands.
    const bands: { from: number; to: number; label: string; sessionId: string }[] = []
    for (const p of seq) {
      const last = bands[bands.length - 1]
      if (last && last.sessionId === p.shot.training_session_id) last.to = p.x
      else bands.push({ from: p.x, to: p.x, label: p.dateLabel, sessionId: p.shot.training_session_id })
    }

    const byClub = new Map<string, { label: string; color: string; points: SeqShot[] }>()
    for (const p of seq) {
      const key = p.shot.club?.id ?? 'none'
      const entry = byClub.get(key) ?? { label: p.shot.clubLabel, color: p.shot.color, points: [] }
      entry.points.push(p)
      byClub.set(key, entry)
    }
    const clubs = [...byClub.values()]

    // Latest session vs everything before it, analyzed shots only.
    const analyzed = seq.filter((p) => !p.shot.excluded)
    const lastIdx = analyzed.length ? Math.max(...analyzed.map((p) => p.sessionIdx)) : -1
    const latest = analyzed.filter((p) => p.sessionIdx === lastIdx)
    const earlier = analyzed.filter((p) => p.sessionIdx !== lastIdx)

    return {
      seq,
      bands,
      clubs,
      latest: latest.length ? { ...meanSd(latest.map((p) => p.v)), n: latest.length } : null,
      earlier: earlier.length ? { ...meanSd(earlier.map((p) => p.v)), n: earlier.length } : null,
    }
  }, [shots, sessions, metric])

  const option = useMemo<EChartsCoreOption>(() => {
    const { seq, bands, clubs } = model
    const values = seq.map((p) => p.v)
    const multi = clubs.length > 1
    const HEIGHT = 320
    const GRID_TOP = 30
    const GRID_BOTTOM = 16

    // Trailing rolling mean and sigma per club, plotted at that club's
    // own shot positions on the shared time axis.
    const rollingOf = (points: SeqShot[]) => {
      const kept = points.filter((p) => !p.shot.excluded)
      return kept
        .map((p, i) => {
          const slice = kept.slice(Math.max(0, i - WINDOW + 1), i + 1)
          if (slice.length < MIN_SAMPLES) return null
          return { x: p.x, ...meanSd(slice.map((q) => q.v)) }
        })
        .filter((r): r is { x: number; mean: number; sd: number } => r !== null)
    }

    const yBounds = (): { min?: number; max?: number; scale?: boolean } => {
      if (!values.length) return {}
      if (!metric.zeroWord) return { scale: true }
      const lo = Math.min(0, ...values)
      const hi = Math.max(0, ...values)
      const pad = (hi - lo) * 0.08 || 1
      // Snap to tick-friendly bounds so the axis edges land on labels.
      const step = hi - lo >= 15 ? 5 : 1
      return {
        min: Math.floor((lo - pad) / step) * step,
        max: Math.ceil((hi + pad) / step) * step,
      }
    }
    const bounds = yBounds()

    const lineClubs = clubs.filter(
      (c) => c.points.filter((p) => !p.shot.excluded).length >= LINE_MIN,
    )

    // ECharts' labelLayout does not resolve endLabel overlaps, so push
    // labels of lines that finish at nearly the same value apart by hand.
    const endOffsets = new Map<string, number>()
    if (multi && values.length) {
      const yLo = bounds.min ?? Math.min(...values)
      const yHi = bounds.max ?? Math.max(...values)
      const pxPer = (HEIGHT - GRID_TOP - GRID_BOTTOM) / (yHi - yLo || 1)
      const finals = lineClubs
        .map((c) => {
          const roll = rollingOf(c.points)
          return { label: c.label, v: roll[roll.length - 1]?.mean ?? 0 }
        })
        .sort((a, b) => b.v - a.v)
      let prevY = -Infinity
      for (const f of finals) {
        const raw = (yHi - f.v) * pxPer
        const y = Math.max(raw, prevY + 14)
        endOffsets.set(f.label, y - raw)
        prevY = y
      }
    }

    const bandSeries = lineClubs.flatMap((c) => {
      if (multi) return []
      const roll = rollingOf(c.points)
      return [
        {
          type: 'line' as const,
          stack: 'sigma',
          stackStrategy: 'all' as const,
          data: roll.map((r) => [r.x, r.mean - r.sd]),
          lineStyle: { opacity: 0 },
          symbol: 'none',
          silent: true,
          z: 1,
        },
        {
          type: 'line' as const,
          stack: 'sigma',
          stackStrategy: 'all' as const,
          data: roll.map((r) => [r.x, 2 * r.sd]),
          lineStyle: { opacity: 0 },
          symbol: 'none',
          areaStyle: { color: hexToRgba(c.color, 0.13) },
          silent: true,
          z: 1,
        },
      ]
    })

    // Flat dashed segment per session at that session's mean, so each
    // session reads as one step against the rolling line.
    const sessionAvgSeries = clubs.map((c) => {
      const bySession = new Map<string, SeqShot[]>()
      for (const p of c.points) {
        if (p.shot.excluded) continue
        const list = bySession.get(p.shot.training_session_id) ?? []
        list.push(p)
        bySession.set(p.shot.training_session_id, list)
      }
      const data: (number[] | null)[] = []
      for (const points of bySession.values()) {
        if (points.length < MIN_SAMPLES) continue
        const { mean } = meanSd(points.map((q) => q.v))
        const xs = points.map((q) => q.x)
        data.push([Math.min(...xs) - 0.5, mean], [Math.max(...xs) + 0.5, mean], null)
      }
      return {
        type: 'line' as const,
        data,
        lineStyle: { color: c.color, width: 1.5, type: 'dashed' as const, opacity: 0.6 },
        symbol: 'none',
        silent: true,
        z: 2,
      }
    })

    const dotSeries = clubs.map((c) => ({
      type: 'scatter' as const,
      symbolSize: 8,
      cursor: 'pointer',
      data: c.points.map<TrendDot & { itemStyle: object }>((p) => ({
        value: [p.x, p.v],
        shotId: p.shot.id,
        excluded: p.shot.excluded,
        clubLabel: p.shot.clubLabel,
        dateLabel: p.dateLabel,
        itemStyle: p.shot.excluded
          ? { color: ink.surface, borderColor: ink.muted, borderWidth: 1.4, opacity: 0.6 }
          : { color: hexToRgba(c.color, 0.55), borderColor: ink.surface, borderWidth: 1 },
      })),
      tooltip: {
        formatter: (p: { data: TrendDot }) => {
          const d = p.data
          return [
            `<b style="color:${ink.text}">${d.clubLabel}</b> · ${d.dateLabel}${d.excluded ? ' (excluded)' : ''}`,
            `${metric.label.toLowerCase()} <b style="color:${ink.text}">${fmtValue(d.value[1], metric)}</b>`,
            `<i>click to ${d.excluded ? 'restore' : 'exclude'}</i>`,
          ].join('<br/>')
        },
      },
      z: 2,
    }))

    const lineSeries = lineClubs.map((c) => ({
      type: 'line' as const,
      data: rollingOf(c.points).map((r) => [r.x, r.mean]),
      lineStyle: { color: c.color, width: 2 },
      itemStyle: { color: c.color },
      symbol: 'none',
      silent: true,
      endLabel: multi
        ? {
            show: true,
            formatter: () => c.label,
            color: c.color,
            fontSize: 11,
            distance: 7,
            offset: [0, endOffsets.get(c.label) ?? 0],
          }
        : { show: false },
      z: 3,
    }))

    return {
      animation: false,
      grid: { left: 56, right: multi ? 78 : 24, top: GRID_TOP, bottom: GRID_BOTTOM },
      tooltip: {
        trigger: 'item',
        backgroundColor: ink.surface,
        borderColor: ink.border,
        textStyle: { color: ink.text2, fontSize: 12.5 },
      },
      xAxis: {
        type: 'value',
        min: -0.5,
        max: Math.max(seq.length - 0.5, 0.5),
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: metric.axisName,
        nameLocation: 'middle',
        nameGap: 42,
        nameTextStyle: { color: ink.muted, fontSize: 11 },
        axisLabel: { color: ink.muted, formatter: metric.unit === '°' ? '{value}°' : '{value}' },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: ink.grid } },
        ...bounds,
      },
      series: [
        // Invisible carrier for the session bands and the zero line.
        {
          type: 'line',
          data: [],
          silent: true,
          z: 0,
          markArea: {
            silent: true,
            data: bands.map((b, i) => [
              {
                xAxis: b.from - 0.5,
                itemStyle: {
                  color:
                    b.sessionId === selectedSessionId
                      ? hexToRgba(ink.axis, 0.18)
                      : i % 2
                        ? hexToRgba(ink.axis, 0.07)
                        : 'transparent',
                },
                label: {
                  show: true,
                  position: 'insideTop' as const,
                  color: ink.muted,
                  fontSize: 11,
                  formatter: b.label,
                },
              },
              { xAxis: b.to + 0.5 },
            ]),
          },
          markLine: metric.zeroWord
            ? {
                silent: true,
                symbol: 'none',
                animation: false,
                data: [
                  {
                    yAxis: 0,
                    lineStyle: { color: ink.axis, type: 'solid' as const, width: 1 },
                    label: {
                      show: true,
                      position: 'insideStartTop' as const,
                      color: ink.muted,
                      fontSize: 11,
                      formatter: metric.zeroWord,
                    },
                  },
                ],
              }
            : undefined,
        },
        ...bandSeries,
        ...sessionAvgSeries,
        ...dotSeries,
        ...lineSeries,
      ],
    }
  }, [model, metric, ink, selectedSessionId])

  const onClick = (params: ChartClick) => {
    const d = params.data as TrendDot | undefined
    if (d?.shotId) onToggle(d.shotId, !d.excluded)
  }

  const { latest, earlier, clubs } = model

  return (
    <section className="card trend-card" aria-label="Progress over time">
      <div className="card-head">
        <div>
          <h2>Progress</h2>
          <p className="subtitle" data-testid="trend-hint">
            {metric.hint} All sessions, oldest to newest. Lines are rolling {WINDOW}-shot averages
            per club, dashes are session averages{clubs.length === 1 ? ', the band is ±1σ' : ''}.
          </p>
        </div>
        <select
          aria-label="Trend metric"
          data-testid="trend-metric"
          value={metricKey}
          onChange={(e) => setMetricKey(e.target.value)}
        >
          {GROUPS.map((g) => (
            <optgroup key={g} label={g}>
              {METRICS.filter((m) => m.group === g).map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {latest && (
        <div className="trend-readout" data-testid="trend-readout">
          <div className="item">
            <span className="label">Latest session</span>
            <span className="value" data-testid="trend-latest">
              {fmtValue(latest.mean, metric)}
              <span className="sub">
                ±{fmtNum(latest.sd, metric)} · {latest.n} shots
              </span>
            </span>
          </div>
          {earlier && (
            <>
              <div className="item">
                <span className="label">Earlier sessions</span>
                <span className="value" data-testid="trend-earlier">
                  {fmtValue(earlier.mean, metric)}
                  <span className="sub">
                    ±{fmtNum(earlier.sd, metric)} · {earlier.n} shots
                  </span>
                </span>
              </div>
              <div className="item">
                <span className="label">Change</span>
                <span className="value" data-testid="trend-delta">
                  {deltaText(latest.mean, earlier.mean, metric)}
                  <span className="sub">
                    spread {earlier.sd > latest.sd ? 'tightened' : 'widened'} by{' '}
                    {fmtNum(Math.abs(earlier.sd - latest.sd), metric)}
                  </span>
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {model.seq.length === 0 ? (
        <p className="subtitle" data-testid="trend-empty">
          No {metric.label.toLowerCase()} data for the current club filter.
        </p>
      ) : (
        <>
          <EChart option={option} height={320} testId="trend-chart" onClick={onClick} />
          {clubs.length > 1 && (
            <div className="fan-legend" data-testid="trend-legend">
              {clubs.map((c) => (
                <span className="entry" key={c.label}>
                  <span className="dot" style={{ background: c.color }} />
                  {c.label}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
