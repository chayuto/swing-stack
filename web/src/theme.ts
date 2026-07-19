export type Mode = 'light' | 'dark'

// Categorical palette, validated all-pairs for up to 4 series in both
// modes (dataviz palette slots 1-4). Club hues are assigned by static
// loft in fixed order and never re-assigned when filters change.
const CLUB_SLOTS: Record<Mode, string[]> = {
  light: ['#2a78d6', '#008300', '#e87ba4', '#eda100'],
  dark: ['#3987e5', '#008300', '#d55181', '#c98500'],
}

const UNCLASSIFIED: Record<Mode, string> = { light: '#8f8d81', dark: '#8b897d' }

// Ink and surface tokens, mirrored in index.css. Charts render to
// canvas/SVG attributes, so they take resolved hex rather than CSS vars.
export const INK: Record<
  Mode,
  { text: string; text2: string; muted: string; grid: string; axis: string; surface: string; border: string }
> = {
  light: {
    text: '#1c1b18',
    text2: '#57554c',
    muted: '#8a887b',
    grid: '#e9e7de',
    axis: '#c9c6ba',
    surface: '#ffffff',
    border: '#e3e1d8',
  },
  dark: {
    text: '#f2f1ea',
    text2: '#c3c2b7',
    muted: '#8b897d',
    grid: '#2a2926',
    axis: '#4a4942',
    surface: '#1a1a19',
    border: '#2e2d29',
  },
}

export function slotColor(slot: number | null, mode: Mode): string {
  if (slot === null) return UNCLASSIFIED[mode]
  return CLUB_SLOTS[mode][slot % CLUB_SLOTS[mode].length]
}

export function hexToRgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
