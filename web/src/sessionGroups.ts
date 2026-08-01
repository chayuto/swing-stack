import type { TrainingSession } from './api/types'
import type { Mode } from './theme'

// Session grouping: colour shots by when they were hit instead of what
// club hit them. Sessions take a sequential ramp, oldest cold violet to
// newest warm orange, so progression reads as a colour sweep. Club
// identity moves to the dot symbol.

export interface SessionSlot {
  id: string
  index: number
  color: string
  label: string
  title: string
}

const RAMP: Record<Mode, [string, string, string]> = {
  light: ['#6f6bd8', '#0e9888', '#e07800'],
  dark: ['#8a86e8', '#17a897', '#eda100'],
}

// Ellipses and mean markers need this many shots in a session-club
// group; below it the sigma is noise.
export const GROUP_MIN = 5

function lerpHex(a: string, b: string, t: number): string {
  const pa = Number.parseInt(a.slice(1), 16)
  const pb = Number.parseInt(b.slice(1), 16)
  const ch = (shift: number) => {
    const va = (pa >> shift) & 0xff
    const vb = (pb >> shift) & 0xff
    return Math.round(va + (vb - va) * t)
  }
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}

export function rampColor(t: number, mode: Mode): string {
  const [a, b, c] = RAMP[mode]
  return t < 0.5 ? lerpHex(a, b, t * 2) : lerpHex(b, c, (t - 0.5) * 2)
}

export function sessionSlots(sessions: TrainingSession[], mode: Mode): Map<string, SessionSlot> {
  const ordered = [...sessions].sort((a, b) =>
    (a.played_on ?? a.created_at).localeCompare(b.played_on ?? b.created_at),
  )
  const last = Math.max(ordered.length - 1, 1)
  return new Map(
    ordered.map((s, index) => {
      const iso = s.played_on ? `${s.played_on}T00:00:00` : s.created_at
      const label = new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
      return [
        s.id,
        {
          id: s.id,
          index,
          color: rampColor(index / last, mode),
          label,
          title: [label, s.facility, s.bay].filter(Boolean).join(' · '),
        },
      ]
    }),
  )
}

// Club identity inside a session-coloured chart: symbol by palette
// slot, mirrored as a text glyph in legends.
const SYMBOLS = ['circle', 'triangle', 'diamond', 'rect']
const GLYPHS = ['●', '▲', '◆', '■']

export function clubSymbol(slot: number | null): string {
  return slot === null ? 'circle' : SYMBOLS[slot % SYMBOLS.length]
}

export function clubGlyph(slot: number | null): string {
  return slot === null ? GLYPHS[0] : GLYPHS[slot % GLYPHS.length]
}

// Drop drill and partial shots before fitting an ellipse: split the
// group's carries at the point that minimises within-cluster variance
// (1D two-means) and keep the long cluster. The split only sticks when
// the clusters sit far apart relative to their own spread AND the short
// cluster is genuinely short-game work, so a session of uniform full
// swings stays whole.
export function fullSwings<T>(shots: T[], carryOf: (s: T) => number | null): T[] {
  const sorted = shots
    .filter((s) => carryOf(s) !== null)
    .sort((a, b) => carryOf(a)! - carryOf(b)!)
  const n = sorted.length
  if (n < GROUP_MIN * 2) return sorted

  const v = sorted.map((s) => carryOf(s)!)
  const sum = [0]
  const sumSq = [0]
  for (let i = 0; i < n; i++) {
    sum.push(sum[i] + v[i])
    sumSq.push(sumSq[i] + v[i] ** 2)
  }
  // Sum of squared deviations over v[from..to)
  const sse = (from: number, to: number) => {
    const s = sum[to] - sum[from]
    return sumSq[to] - sumSq[from] - (s * s) / (to - from)
  }

  let best = -1
  let bestSse = Infinity
  for (let k = 2; k <= n - GROUP_MIN; k++) {
    const s = sse(0, k) + sse(k, n)
    if (s < bestSse) {
      bestSse = s
      best = k
    }
  }
  if (best < 0) return sorted

  const lowerMean = sum[best] / best
  const upperMean = (sum[n] - sum[best]) / (n - best)
  const pooledSd = Math.sqrt(bestSse / Math.max(n - 2, 1))
  if (upperMean - lowerMean > 2 * pooledSd && lowerMean < 0.65 * upperMean) {
    return sorted.slice(best)
  }
  return sorted
}

export function meanSd(values: number[]): { mean: number; sd: number } {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sd =
    values.length > 1
      ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1))
      : 0
  return { mean, sd }
}

// TrackMan-style dispersion ellipse: the covariance ellipse of the
// group, oriented along the shot pattern and scaled to k sigma so it
// wraps the cloud instead of floating inside it (k = 2 covers about
// 86% of a normal group).
export interface CovEllipse {
  cx: number
  cy: number
  /** Semi-axes in data units, r1 along phi */
  r1: number
  r2: number
  /** Major-axis angle in radians, data space, y up */
  phi: number
}

export function covEllipse(xs: number[], ys: number[], k = 2, floor = 0): CovEllipse {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2
    syy += (ys[i] - my) ** 2
    sxy += (xs[i] - mx) * (ys[i] - my)
  }
  const d = Math.max(n - 1, 1)
  sxx /= d
  syy /= d
  sxy /= d

  const half = (sxx + syy) / 2
  const spread = Math.sqrt(Math.max(half ** 2 - (sxx * syy - sxy ** 2), 0))
  const l1 = Math.max(half + spread, 0)
  const l2 = Math.max(half - spread, 0)
  const phi = Math.abs(sxy) < 1e-9 ? (sxx >= syy ? 0 : Math.PI / 2) : Math.atan2(l1 - sxx, sxy)
  return {
    cx: mx,
    cy: my,
    r1: Math.max(k * Math.sqrt(l1), floor),
    r2: Math.max(k * Math.sqrt(l2), floor),
    phi,
  }
}

// Ellipse outline as data-space points, for charts where the two axes
// scale differently (an affine map keeps it an exact ellipse).
export function ellipsePoints(e: CovEllipse, steps = 48): [number, number][] {
  const cos = Math.cos(e.phi)
  const sin = Math.sin(e.phi)
  const pts: [number, number][] = []
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI
    const a = e.r1 * Math.cos(t)
    const b = e.r2 * Math.sin(t)
    pts.push([e.cx + a * cos - b * sin, e.cy + a * sin + b * cos])
  }
  return pts
}
