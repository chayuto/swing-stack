import { useMemo } from 'react'
import type { EChartsCoreOption } from 'echarts/core'
import type { CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from 'echarts'
import type { Mode } from '../theme'
import { hexToRgba, INK } from '../theme'
import type { FanShot } from './RangeFan'
import { EChart } from './EChart'

// Carry gapping: one row per club, every shot as a dot, with a
// mean +/- 1 sigma band. Rows are ordered shortest to longest so the
// vertical axis reads like a bag chart.

interface Props {
  shots: FanShot[]
  mode: Mode
}

// Deterministic per-shot jitter so dots do not move between renders.
function jitter(id: string): number {
  let h = 2166136261
  for (const c of id) h = Math.imul(h ^ c.codePointAt(0)!, 16777619)
  return (((h >>> 0) % 1000) / 1000 - 0.5) * 0.5
}

export function GappingChart({ shots, mode }: Props) {
  const ink = INK[mode]

  const { option, rows } = useMemo(() => {
    const byClub = new Map<string, { label: string; color: string; carries: { id: string; carry: number }[] }>()
    for (const s of shots) {
      if (s.carry === null) continue
      const key = s.club?.id ?? 'none'
      const entry = byClub.get(key) ?? { label: s.clubLabel, color: s.color, carries: [] }
      entry.carries.push({ id: s.id, carry: s.carry })
      byClub.set(key, entry)
    }

    const clubs = [ ...byClub.values() ]
      .map((c) => {
        const values = c.carries.map((x) => x.carry)
        const mean = values.reduce((a, b) => a + b, 0) / values.length
        const sd =
          values.length > 1
            ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1))
            : 0
        return { ...c, mean, sd }
      })
      .sort((a, b) => a.mean - b.mean)

    const carries = clubs.flatMap((c) => c.carries.map((x) => x.carry))
    const minX = carries.length ? Math.max(0, Math.floor((Math.min(...carries) - 8) / 10) * 10) : 0
    const maxX = carries.length ? Math.ceil((Math.max(...carries) + 8) / 10) * 10 : 100

    const renderBand =
      (color: string) => (_params: CustomSeriesRenderItemParams, api: CustomSeriesRenderItemAPI) => {
        const lo = api.coord([ api.value(0), api.value(3) ])
        const hi = api.coord([ api.value(1), api.value(3) ])
        const mean = api.coord([ api.value(2), api.value(3) ])
        const h = 34
        return {
          type: 'group' as const,
          children: [
            {
              type: 'rect' as const,
              shape: { x: lo[0], y: lo[1] - h / 2, width: Math.max(hi[0] - lo[0], 2), height: h },
              style: { fill: hexToRgba(color, 0.13) },
            },
            {
              type: 'rect' as const,
              shape: { x: mean[0] - 1.25, y: mean[1] - h / 2, width: 2.5, height: h },
              style: { fill: color },
            },
          ],
        }
      }

    const opt: EChartsCoreOption = {
      animation: false,
      grid: { left: 104, right: 26, top: 12, bottom: 34 },
      tooltip: {
        trigger: 'item',
        backgroundColor: ink.surface,
        borderColor: ink.border,
        textStyle: { color: ink.text2, fontSize: 12.5 },
      },
      xAxis: {
        type: 'value',
        min: minX,
        max: maxX,
        axisLabel: { color: ink.muted, formatter: '{value} m' },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: ink.grid } },
      },
      yAxis: {
        type: 'value',
        min: -0.6,
        max: clubs.length - 0.4,
        // Value axis so dots can jitter within a row; ticks pinned to
        // the integer row centers, labelled club + mean +/- sigma.
        axisLabel: {
          customValues: clubs.map((_, idx) => idx),
          formatter: (v: number) => {
            const c = clubs[v]
            return c ? `{club|${c.label}}\n{stat|${c.mean.toFixed(0)} ±${c.sd.toFixed(0)} m}` : ''
          },
          rich: {
            club: { color: ink.text2, fontWeight: 600, fontSize: 12.5, align: 'right' as const },
            stat: { color: ink.muted, fontSize: 11, align: 'right' as const, padding: [ 2, 0, 0, 0 ] },
          },
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      series: [
        ...clubs.map((c, idx) => ({
          type: 'custom' as const,
          renderItem: renderBand(c.color),
          data: [ [ c.mean - c.sd, c.mean + c.sd, c.mean, idx ] ],
          silent: true,
          z: 1,
        })),
        ...clubs.map((c, idx) => ({
          type: 'scatter' as const,
          symbolSize: 9,
          data: c.carries.map((x) => ({
            value: [ x.carry, idx + jitter(x.id) ],
            name: c.label,
          })),
          itemStyle: { color: hexToRgba(c.color, 0.85), borderColor: ink.surface, borderWidth: 1 },
          tooltip: {
            formatter: (p: { value: number[]; name: string }) =>
              `${p.name}: <b style="color:${ink.text}">${p.value[0].toFixed(1)} m</b>`,
          },
          z: 2,
        })),
      ],
    }
    return { option: opt, rows: clubs.length }
  }, [shots, ink])

  return <EChart option={option} height={Math.max(rows, 1) * 62 + 50} testId="gapping-chart" />
}
