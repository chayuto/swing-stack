import { useMemo } from 'react'
import type { EChartsCoreOption } from 'echarts/core'
import type { Mode } from '../theme'
import { hexToRgba, INK } from '../theme'
import type { FanShot } from './RangeFan'
import type { ChartClick } from './EChart'
import { EChart } from './EChart'

// Impact geometry: face angle against club path, both in degrees.
// The dashed diagonal is face = path (zero side spin). Above it the
// face is open to the path (fade side spin), below it closed (draw).
// Clicking a dot flags the shot out of analysis.

interface Props {
  shots: FanShot[]
  mode: Mode
  onToggle: (id: string, excluded: boolean) => void
}

interface DotDatum {
  value: [number, number]
  shotId: string
  excluded: boolean
  label: string
  color: string
  faceToPath: number | null
  carry: number | null
  side: number | null
}

export function ShotShapeChart({ shots, mode, onToggle }: Props) {
  const ink = INK[mode]

  const option = useMemo<EChartsCoreOption>(() => {
    const plotted = shots.filter((s) => s.face_angle !== null && s.club_path !== null)
    const extent = Math.max(
      5,
      ...plotted.map((s) => Math.max(Math.abs(s.face_angle!), Math.abs(s.club_path!))),
    )
    const r = Math.ceil(extent / 5) * 5

    const data: DotDatum[] = plotted.map((s) => ({
      value: [s.club_path!, s.face_angle!],
      shotId: s.id,
      excluded: s.excluded,
      label: s.clubLabel,
      color: s.color,
      faceToPath: s.face_to_path,
      carry: s.carry,
      side: s.total_side,
    }))

    const axis = (name: string) => ({
      type: 'value' as const,
      name,
      nameLocation: 'middle' as const,
      nameTextStyle: { color: ink.muted, fontSize: 11 },
      min: -r,
      max: r,
      axisLabel: { color: ink.muted, formatter: '{value}°' },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: ink.grid } },
    })

    return {
      animation: false,
      grid: { left: 58, right: 20, top: 18, bottom: 46 },
      tooltip: {
        trigger: 'item',
        backgroundColor: ink.surface,
        borderColor: ink.border,
        textStyle: { color: ink.text2, fontSize: 12.5 },
      },
      xAxis: { ...axis('club path (° in-to-out)'), nameGap: 30 },
      yAxis: { ...axis('face angle (° open)'), nameGap: 40 },
      graphic: [
        {
          type: 'text',
          left: '16%',
          top: '10%',
          style: { text: 'fade side spin', fill: ink.muted, fontSize: 11 },
          silent: true,
        },
        {
          type: 'text',
          right: '8%',
          bottom: '18%',
          style: { text: 'draw side spin', fill: ink.muted, fontSize: 11 },
          silent: true,
        },
      ],
      series: [
        {
          type: 'scatter',
          symbolSize: 9.5,
          cursor: 'pointer',
          data: data.map((d) => ({
            ...d,
            itemStyle: d.excluded
              ? { color: ink.surface, borderColor: ink.muted, borderWidth: 1.4, opacity: 0.6 }
              : { color: hexToRgba(d.color, 0.85), borderColor: ink.surface, borderWidth: 1 },
          })),
          tooltip: {
            formatter: (p: { data: DotDatum }) => {
              const d = p.data
              const rows = [
                `<b style="color:${ink.text}">${d.label}</b>${d.excluded ? ' (excluded)' : ''}`,
                `face ${d.value[1].toFixed(1)}°, path ${d.value[0].toFixed(1)}°`,
                d.faceToPath !== null ? `face to path ${d.faceToPath.toFixed(1)}°` : null,
                d.carry !== null ? `carry ${d.carry.toFixed(0)} m` : null,
                d.side !== null ? `side ${Math.abs(d.side).toFixed(1)} m ${d.side < 0 ? 'L' : 'R'}` : null,
                `<i>click to ${d.excluded ? 'restore' : 'exclude'}</i>`,
              ]
              return rows.filter(Boolean).join('<br/>')
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            animation: false,
            label: { show: false },
            data: [
              { xAxis: 0, lineStyle: { color: ink.axis, type: 'solid', width: 1 } },
              { yAxis: 0, lineStyle: { color: ink.axis, type: 'solid', width: 1 } },
              [
                { coord: [-r, -r], lineStyle: { color: ink.muted, type: 'dashed', width: 1 } },
                { coord: [r, r] },
              ],
            ],
          },
          z: 2,
        },
      ],
    }
  }, [shots, ink])

  const onClick = (params: ChartClick) => {
    const d = params.data as DotDatum | undefined
    if (d?.shotId) onToggle(d.shotId, !d.excluded)
  }

  return <EChart option={option} height={300} testId="shot-shape-chart" onClick={onClick} />
}
