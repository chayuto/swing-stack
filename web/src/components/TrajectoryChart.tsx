import { useMemo } from 'react'
import type { EChartsCoreOption } from 'echarts/core'
import type { Mode } from '../theme'
import { hexToRgba, INK } from '../theme'
import type { FanShot } from './RangeFan'
import { EChart } from './EChart'

// Side-on ball flight: downrange metres vs height metres, one polyline
// per shot from the stored TrackMan trajectory points.

interface Props {
  shots: FanShot[]
  mode: Mode
}

export function TrajectoryChart({ shots, mode }: Props) {
  const ink = INK[mode]

  const option = useMemo<EChartsCoreOption>(() => {
    const flighted = shots.filter((s) => s.ball_trajectory && s.ball_trajectory.length > 1)
    const maxX = Math.max(100, Math.ceil((Math.max(0, ...flighted.map((s) => s.ball_trajectory!.at(-1)![0])) * 1.04) / 10) * 10)
    const maxY = Math.max(20, Math.ceil((Math.max(0, ...flighted.map((s) => s.max_height ?? 0)) * 1.25) / 5) * 5)

    return {
      animation: false,
      grid: { left: 44, right: 18, top: 20, bottom: 34 },
      tooltip: {
        trigger: 'item',
        backgroundColor: ink.surface,
        borderColor: ink.border,
        textStyle: { color: ink.text2, fontSize: 12.5 },
        formatter: (params: { seriesIndex: number }) => {
          const s = flighted[params.seriesIndex]
          const rows = [
            `<b style="color:${ink.text}">${s.clubLabel}</b>`,
            s.carry !== null ? `Carry <b style="color:${ink.text}">${s.carry.toFixed(1)} m</b>` : null,
            s.max_height !== null ? `Apex <b style="color:${ink.text}">${s.max_height.toFixed(1)} m</b>` : null,
            s.hang_time !== null ? `Hang <b style="color:${ink.text}">${s.hang_time.toFixed(1)} s</b>` : null,
          ]
          return rows.filter(Boolean).join('<br/>')
        },
      },
      xAxis: {
        type: 'value',
        max: maxX,
        axisLabel: { color: ink.muted, formatter: '{value} m' },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: ink.grid } },
      },
      yAxis: {
        type: 'value',
        max: maxY,
        axisLabel: { color: ink.muted, formatter: '{value} m' },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: ink.grid } },
      },
      series: flighted.map((s) => ({
        type: 'line',
        showSymbol: false,
        triggerEvent: true,
        silent: false,
        data: s.ball_trajectory!.map((p) => [ p[0], p[1] ]),
        lineStyle: { width: 1.3, color: hexToRgba(s.color, 0.45) },
        emphasis: { focus: 'series', lineStyle: { width: 2.6, color: s.color } },
        blur: { lineStyle: { opacity: 0.08 } },
      })),
    }
  }, [shots, ink])

  return <EChart option={option} height={252} testId="trajectory-chart" />
}
