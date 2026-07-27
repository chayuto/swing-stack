import { useMemo } from 'react'
import type { EChartsCoreOption } from 'echarts/core'
import type { TrainingSession } from '../api/types'
import type { Mode } from '../theme'
import { hexToRgba, INK } from '../theme'
import type { FanShot } from './RangeFan'
import { EChart } from './EChart'

// Session-level rollup: one point per session per club across four fixed
// panels. The Progress card answers "where are my last ten swings
// trending"; this one answers "is the training working session over
// session": distance control, face bias and spread, mishit rate, and
// strike quality. Distributions, not means, because mishits skew a mean:
// the carry panel uses the median and the middle-50% band.

const MIN_SESSION_SHOTS = 8 // fewer swings than this is not a session read
const MIN_METRIC_N = 4 // a distribution stat needs at least this many values
const MISHIT_SMASH = 1.1
const FLUSH_SMASH = 1.3

interface Stat {
  /** Line value: the session's median or mean */
  value: number
  /** Band bounds; null for the rate and ratio panels */
  lo: number | null
  hi: number | null
  headline: string
  /** Compact form for the "was …" comparison */
  short: string
  detail: string[]
}

interface Panel {
  key: string
  title: string
  sub: string
  yFmt?: string
  scale?: boolean
  zeroWord?: string
  refLine?: { at: number; word: string }
  yMin?: number | ((v: { min: number }) => number)
  yMax?: (v: { max: number }) => number
  compute: (shots: FanShot[]) => Stat | null
}

interface TrendPoint {
  value: number
  clubLabel: string
  dateLabel: string
  detail: string[]
}

function nums(values: (number | null)[]): number[] {
  return values.filter((v): v is number => v !== null)
}

function quantile(sorted: number[], p: number): number {
  const i = p * (sorted.length - 1)
  const lo = Math.floor(i)
  const hi = Math.min(lo + 1, sorted.length - 1)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

function meanSd(values: number[]): { mean: number; sd: number } {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sd =
    values.length > 1
      ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1))
      : 0
  return { mean, sd }
}

const PANELS: Panel[] = [
  {
    key: 'carry',
    title: 'Distance control',
    sub: 'carry median, band is the middle 50%',
    scale: true,
    compute: (shots) => {
      const v = nums(shots.map((s) => s.carry)).sort((a, b) => a - b)
      if (v.length < MIN_METRIC_N) return null
      const med = quantile(v, 0.5)
      const p25 = quantile(v, 0.25)
      const p75 = quantile(v, 0.75)
      const iqr = p75 - p25
      return {
        value: med,
        lo: p25,
        hi: p75,
        headline: `${med.toFixed(1)} m · IQR ${iqr.toFixed(1)}`,
        short: `IQR ${iqr.toFixed(1)} m`,
        detail: [
          `carry median ${med.toFixed(1)} m`,
          `middle 50% within ${iqr.toFixed(1)} m · ${v.length} shots`,
        ],
      }
    },
  },
  {
    key: 'face',
    title: 'Face angle',
    sub: 'mean ±1σ, zero is square',
    yFmt: '{value}°',
    zeroWord: 'square',
    yMin: (v) => Math.floor(Math.min(0, v.min)),
    yMax: (v) => Math.ceil(Math.max(0, v.max)),
    compute: (shots) => {
      const v = nums(shots.map((s) => s.face_angle))
      if (v.length < MIN_METRIC_N) return null
      const { mean, sd } = meanSd(v)
      const word = Math.abs(mean) < 0.05 ? 'square' : mean > 0 ? 'open' : 'closed'
      const bias = `${Math.abs(mean).toFixed(1)}° ${word}`
      return {
        value: mean,
        lo: mean - sd,
        hi: mean + sd,
        headline: `${bias} · ±${sd.toFixed(1)}°`,
        short: `${bias} ±${sd.toFixed(1)}°`,
        detail: [`face mean ${bias}`, `spread ±${sd.toFixed(1)}° · ${v.length} shots`],
      }
    },
  },
  {
    key: 'mishit',
    title: 'Mishit rate',
    sub: `swings under ${MISHIT_SMASH.toFixed(2)} smash`,
    yFmt: '{value}%',
    yMin: 0,
    yMax: (v) => Math.max(10, Math.ceil(v.max / 5) * 5),
    compute: (shots) => {
      const v = nums(shots.map((s) => s.smash_factor))
      if (v.length < MIN_METRIC_N) return null
      const bad = v.filter((x) => x < MISHIT_SMASH).length
      const pct = (bad * 100) / v.length
      return {
        value: pct,
        lo: null,
        hi: null,
        headline: `${pct.toFixed(0)}%`,
        short: `${pct.toFixed(0)}%`,
        detail: [`${bad} of ${v.length} swings under ${MISHIT_SMASH.toFixed(2)} smash`],
      }
    },
  },
  {
    key: 'smash',
    title: 'Smash factor',
    sub: 'median ball speed per club speed',
    refLine: { at: FLUSH_SMASH, word: 'flush' },
    yMin: (v) => Math.floor((Math.min(v.min, FLUSH_SMASH) - 0.02) * 20) / 20,
    yMax: (v) => Math.ceil((Math.max(v.max, FLUSH_SMASH) + 0.02) * 20) / 20,
    compute: (shots) => {
      const v = nums(shots.map((s) => s.smash_factor)).sort((a, b) => a - b)
      if (v.length < MIN_METRIC_N) return null
      const med = quantile(v, 0.5)
      return {
        value: med,
        lo: null,
        hi: null,
        headline: med.toFixed(2),
        short: med.toFixed(2),
        detail: [`smash median ${med.toFixed(2)}`, `flush is about ${FLUSH_SMASH.toFixed(2)} · ${v.length} shots`],
      }
    },
  },
]

interface Props {
  /** Club-filtered shots, all sessions; excluded shots are dropped here */
  shots: FanShot[]
  sessions: TrainingSession[]
  selectedSessionId: string
  mode: Mode
}

export function SessionTrendsCard({ shots, sessions, selectedSessionId, mode }: Props) {
  const ink = INK[mode]

  const model = useMemo(() => {
    const ordered = [...sessions].sort((a, b) =>
      (a.played_on ?? a.created_at).localeCompare(b.played_on ?? b.created_at),
    )
    const slotOf = new Map(ordered.map((s, i) => [s.id, i]))
    const labels = ordered.map((s) => {
      const iso = s.played_on ? `${s.played_on}T00:00:00` : s.created_at
      return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    })

    const byClub = new Map<
      string,
      { label: string; color: string; total: number; slots: FanShot[][] }
    >()
    for (const s of shots) {
      if (s.excluded) continue
      const slot = slotOf.get(s.training_session_id)
      if (slot === undefined) continue
      const key = s.club?.id ?? 'none'
      let entry = byClub.get(key)
      if (!entry) {
        entry = { label: s.clubLabel, color: s.color, total: 0, slots: ordered.map(() => []) }
        byClub.set(key, entry)
      }
      entry.total += 1
      entry.slots[slot].push(s)
    }

    // A club earns a series once it has at least one real session block.
    const clubs = [...byClub.values()]
      .filter((c) => c.slots.some((g) => g.length >= MIN_SESSION_SHOTS))
      .sort((a, b) => b.total - a.total)

    // Per panel, per club: one Stat (or null) per session slot.
    const stats = new Map<string, Map<string, (Stat | null)[]>>()
    for (const panel of PANELS) {
      const perClub = new Map<string, (Stat | null)[]>()
      for (const c of clubs) {
        perClub.set(
          c.label,
          c.slots.map((g) => (g.length >= MIN_SESSION_SHOTS ? panel.compute(g) : null)),
        )
      }
      stats.set(panel.key, perClub)
    }

    return { labels, clubs, stats, selectedIdx: slotOf.get(selectedSessionId) ?? -1 }
  }, [shots, sessions, selectedSessionId])

  // Headline numbers follow the club with the most shots.
  const readout = (panelKey: string): { headline: string; was: string | null } | null => {
    const primary = model.clubs[0]
    if (!primary) return null
    const arr = model.stats.get(panelKey)!.get(primary.label)!
    const present = arr.filter((st): st is Stat => st !== null)
    if (present.length === 0) return null
    const latest = present[present.length - 1]
    const prev = present.length > 1 ? present[present.length - 2] : null
    return { headline: latest.headline, was: prev ? prev.short : null }
  }

  const optionFor = (panel: Panel): EChartsCoreOption => {
    const perClub = model.stats.get(panel.key)!
    const single = model.clubs.length === 1
    const series: object[] = [
      // Invisible carrier for the square and flush reference lines.
      {
        type: 'line',
        data: [],
        silent: true,
        z: 0,
        markLine:
          panel.zeroWord || panel.refLine
            ? {
                silent: true,
                symbol: 'none',
                animation: false,
                data: [
                  {
                    yAxis: panel.zeroWord ? 0 : panel.refLine!.at,
                    lineStyle: {
                      color: ink.axis,
                      type: panel.zeroWord ? ('solid' as const) : ('dashed' as const),
                      width: 1,
                    },
                    label: {
                      show: true,
                      // Reference words sit at opposite ends so they clear
                      // the first-session dots (driver data starts at the left).
                      position: panel.zeroWord
                        ? ('insideStartTop' as const)
                        : ('insideEndTop' as const),
                      color: ink.muted,
                      fontSize: 10.5,
                      formatter: panel.zeroWord ?? panel.refLine!.word,
                    },
                  },
                ],
              }
            : undefined,
      },
    ]

    for (const c of model.clubs) {
      const arr = perClub.get(c.label)!
      // Bands read as mush with several clubs, so they are single-club only.
      if (single && arr.some((st) => st !== null && st.lo !== null)) {
        series.push(
          {
            type: 'line',
            stack: 'band',
            stackStrategy: 'all',
            data: arr.map((st) => (st !== null && st.lo !== null ? st.lo : null)),
            lineStyle: { opacity: 0 },
            symbol: 'none',
            silent: true,
            z: 1,
          },
          {
            type: 'line',
            stack: 'band',
            stackStrategy: 'all',
            data: arr.map((st) =>
              st !== null && st.lo !== null && st.hi !== null ? st.hi - st.lo : null,
            ),
            lineStyle: { opacity: 0 },
            symbol: 'none',
            areaStyle: { color: hexToRgba(c.color, 0.13) },
            silent: true,
            z: 1,
          },
        )
      }
      series.push({
        type: 'line',
        data: arr.map((st, i) =>
          st === null
            ? null
            : {
                value: st.value,
                clubLabel: c.label,
                dateLabel: model.labels[i],
                detail: st.detail,
                symbolSize: i === model.selectedIdx ? 9.5 : 7,
                itemStyle: {
                  color: c.color,
                  borderColor: i === model.selectedIdx ? ink.text : ink.surface,
                  borderWidth: i === model.selectedIdx ? 1.6 : 1,
                },
              },
        ),
        connectNulls: true,
        lineStyle: { color: c.color, width: 2 },
        itemStyle: { color: c.color },
        symbol: 'circle',
        symbolSize: 7,
        z: 2,
      })
    }

    return {
      animation: false,
      grid: { left: 42, right: 14, top: 12, bottom: 22 },
      tooltip: {
        trigger: 'item',
        backgroundColor: ink.surface,
        borderColor: ink.border,
        textStyle: { color: ink.text2, fontSize: 12.5 },
        formatter: (p: { data?: TrendPoint }) => {
          const d = p.data
          if (!d?.detail) return ''
          return [`<b style="color:${ink.text}">${d.clubLabel}</b> · ${d.dateLabel}`, ...d.detail].join(
            '<br/>',
          )
        },
      },
      xAxis: {
        type: 'category',
        data: model.labels,
        axisLabel: { color: ink.muted, fontSize: 10.5, hideOverlap: true },
        axisLine: { lineStyle: { color: ink.axis } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: panel.scale ?? false,
        min: panel.yMin,
        max: panel.yMax,
        splitNumber: 4,
        axisLabel: { color: ink.muted, fontSize: 10.5, formatter: panel.yFmt },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: ink.grid } },
      },
      series,
    }
  }

  const primary = model.clubs[0]

  return (
    <section className="card session-trends" aria-label="Session trends" data-testid="session-trends">
      <div className="card-head">
        <div>
          <h2>Session trends</h2>
          <p className="subtitle">
            One point per session per club, oldest to newest. A club needs {MIN_SESSION_SHOTS}+
            swings in a session to count; excluded shots never feed these stats.
            {model.clubs.length > 1 && primary && <> Headline numbers follow {primary.label}.</>}
          </p>
        </div>
      </div>
      {model.clubs.length === 0 ? (
        <p className="subtitle" data-testid="session-trends-empty">
          No session has {MIN_SESSION_SHOTS}+ swings for the current club filter.
        </p>
      ) : (
        <>
          <div className="panels">
            {PANELS.map((p) => {
              const r = readout(p.key)
              return (
                <div className="mini-panel" key={p.key}>
                  <div className="panel-head">
                    <div>
                      <h3>{p.title}</h3>
                      <span className="panel-sub">{p.sub}</span>
                    </div>
                    {r && (
                      <span className="latest" data-testid={`session-trend-${p.key}-latest`}>
                        {r.headline}
                        {r.was && <span className="sub">was {r.was}</span>}
                      </span>
                    )}
                  </div>
                  <EChart option={optionFor(p)} height={175} testId={`session-trend-${p.key}`} />
                </div>
              )
            })}
          </div>
          {model.clubs.length > 1 && (
            <div className="fan-legend" data-testid="session-trends-legend">
              {model.clubs.map((c) => (
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
