import { useMemo } from 'react'
import type { EChartsCoreOption } from 'echarts/core'
import type { CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from 'echarts'
import type { Mode } from '../theme'
import { hexToRgba, INK } from '../theme'
import type { CovEllipse, SessionSlot } from '../sessionGroups'
import { covEllipse, ellipsePoints, fullSwings, GROUP_MIN } from '../sessionGroups'
import type { FanShot } from './RangeFan'
import type { ChartClick } from './EChart'
import { EChart } from './EChart'

// Impact geometry: face angle against club path, both in degrees.
// The dashed diagonal is face = path (zero side spin). Above it the
// face is open to the path (fade side spin), below it closed (draw).
// Clicking a dot flags the shot out of analysis.
//
// With session grouping on, dots take the session ramp colour and the
// club moves to the symbol. Each session-club group of GROUP_MIN+
// shots draws a 1-sigma ellipse, session means chain into a trail, and
// hovering a dot or a legend entry isolates that session.

interface Props {
  shots: FanShot[]
  mode: Mode
  onToggle: (id: string, excluded: boolean) => void
  /** Session ramp slots; null renders the classic by-club view */
  sessionSlots: Map<string, SessionSlot> | null
  hoverSessionId: string | null
  symbolOf: (clubId: string | null) => string
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
  dateLabel?: string
}

interface EllipseSpec {
  ellipse: CovEllipse
  color: string
  dim: boolean
}

export function ShotShapeChart({
  shots,
  mode,
  onToggle,
  sessionSlots,
  hoverSessionId,
  symbolOf,
}: Props) {
  const ink = INK[mode]

  const option = useMemo<EChartsCoreOption>(() => {
    const plotted = shots.filter((s) => s.face_angle !== null && s.club_path !== null)
    const extent = Math.max(
      5,
      ...plotted.map((s) => Math.max(Math.abs(s.face_angle!), Math.abs(s.club_path!))),
    )
    const r = Math.ceil(extent / 5) * 5

    const dotStyle = (s: FanShot, color: string, dimmed: boolean) =>
      s.excluded
        ? { color: ink.surface, borderColor: ink.muted, borderWidth: 1.4, opacity: dimmed ? 0.15 : 0.6 }
        : {
            color: hexToRgba(color, dimmed ? 0.1 : 0.85),
            borderColor: ink.surface,
            borderWidth: 1,
            opacity: dimmed ? 0.25 : 1,
          }

    const toDatum = (s: FanShot, color: string, dateLabel?: string): DotDatum => ({
      value: [s.club_path!, s.face_angle!],
      shotId: s.id,
      excluded: s.excluded,
      label: s.clubLabel,
      color,
      faceToPath: s.face_to_path,
      carry: s.carry,
      side: s.total_side,
      dateLabel,
    })

    const dotTooltip = {
      formatter: (p: { data: DotDatum }) => {
        const d = p.data
        const head = d.dateLabel ? `${d.label} · ${d.dateLabel}` : d.label
        const rows = [
          `<b style="color:${ink.text}">${head}</b>${d.excluded ? ' (excluded)' : ''}`,
          `face ${d.value[1].toFixed(1)}°, path ${d.value[0].toFixed(1)}°`,
          d.faceToPath !== null ? `face to path ${d.faceToPath.toFixed(1)}°` : null,
          d.carry !== null ? `carry ${d.carry.toFixed(0)} m` : null,
          d.side !== null ? `side ${Math.abs(d.side).toFixed(1)} m ${d.side < 0 ? 'L' : 'R'}` : null,
          `<i>click to ${d.excluded ? 'restore' : 'exclude'}</i>`,
        ]
        return rows.filter(Boolean).join('<br/>')
      },
    }

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

    const markLine = {
      silent: true,
      symbol: 'none',
      animation: false,
      label: { show: false },
      data: [
        { xAxis: 0, lineStyle: { color: ink.axis, type: 'solid' as const, width: 1 } },
        { yAxis: 0, lineStyle: { color: ink.axis, type: 'solid' as const, width: 1 } },
        [
          { coord: [-r, -r], lineStyle: { color: ink.muted, type: 'dashed' as const, width: 1 } },
          { coord: [r, r] },
        ],
      ],
    }

    let series: object[]

    if (!sessionSlots) {
      series = [
        {
          type: 'scatter',
          symbolSize: 9.5,
          cursor: 'pointer',
          data: plotted.map((s) => ({
            ...toDatum(s, s.color),
            itemStyle: dotStyle(s, s.color, false),
          })),
          tooltip: dotTooltip,
          markLine,
          z: 2,
        },
      ]
    } else {
      // One scatter series per session so ECharts' own focus blur
      // isolates a session on dot hover. Legend hover arrives as
      // hoverSessionId and bakes the same dimming into the styles.
      const bySession = new Map<string, FanShot[]>()
      for (const s of plotted) {
        bySession.set(s.training_session_id, [...(bySession.get(s.training_session_id) ?? []), s])
      }
      const groups = [...bySession.entries()]
        .map(([id, list]) => ({ slot: sessionSlots.get(id), list }))
        .filter((g): g is { slot: SessionSlot; list: FanShot[] } => g.slot !== undefined)
        .sort((a, b) => a.slot.index - b.slot.index)

      const dimmed = (id: string) => hoverSessionId !== null && hoverSessionId !== id

      const scatterSeries = groups.map((g) => ({
        type: 'scatter' as const,
        symbolSize: 9,
        cursor: 'pointer',
        emphasis: { focus: 'series' as const, blurScope: 'coordinateSystem' as const },
        blur: { itemStyle: { opacity: 0.1 } },
        data: g.list.map((s) => ({
          ...toDatum(s, g.slot.color, g.slot.label),
          symbol: symbolOf(s.club?.id ?? null),
          itemStyle: dotStyle(s, g.slot.color, dimmed(g.slot.id)),
        })),
        tooltip: dotTooltip,
        z: 2,
      }))

      // 1-sigma ellipse per session-club group, plus a session-mean
      // trail per club so drift over time reads as a path.
      const ellipses: EllipseSpec[] = []
      const trails = new Map<string, { value: [number, number]; itemStyle: { color: string } }[]>()
      for (const g of groups) {
        const byClub = new Map<string, FanShot[]>()
        for (const s of g.list) {
          if (!s.club || s.excluded) continue
          byClub.set(s.club.id, [...(byClub.get(s.club.id) ?? []), s])
        }
        for (const [clubId, list] of byClub) {
          // Impact geometry differs between drills and full swings, so
          // the ellipse and trail fit full swings only.
          const kept = fullSwings(list, (s) => s.carry)
          if (kept.length < GROUP_MIN) continue
          const e = covEllipse(
            kept.map((s) => s.club_path!),
            kept.map((s) => s.face_angle!),
            2,
            0.3,
          )
          ellipses.push({ ellipse: e, color: g.slot.color, dim: dimmed(g.slot.id) })
          trails.set(clubId, [
            ...(trails.get(clubId) ?? []),
            { value: [e.cx, e.cy], itemStyle: { color: g.slot.color } },
          ])
        }
      }

      const ellipseSeries = {
        type: 'custom' as const,
        silent: true,
        // A rotated data-space ellipse maps through the unequal axis
        // scales as a polygon of its outline points.
        renderItem: (params: CustomSeriesRenderItemParams, api: CustomSeriesRenderItemAPI) => {
          const e = ellipses[params.dataIndex]
          const points = ellipsePoints(e.ellipse).map((p) => api.coord(p))
          return {
            type: 'polygon' as const,
            shape: { points },
            style: {
              fill: hexToRgba(e.color, e.dim ? 0.02 : 0.07),
              stroke: hexToRgba(e.color, e.dim ? 0.12 : 0.5),
              lineWidth: hoverSessionId !== null && !e.dim ? 1.8 : 1,
              lineDash: [4, 4],
            },
          }
        },
        blur: { style: { opacity: 0.3 } },
        data: ellipses.map((e) => [e.ellipse.cx, e.ellipse.cy]),
        z: 1,
      }

      const trailSeries = [...trails.values()]
        .filter((points) => points.length >= 2)
        .map((points) => ({
          type: 'line' as const,
          silent: true,
          data: points,
          lineStyle: {
            color: ink.muted,
            width: 1,
            type: 'dashed' as const,
            opacity: hoverSessionId !== null ? 0.15 : 0.6,
          },
          symbol: 'circle',
          symbolSize: 6,
          blur: { lineStyle: { opacity: 0.15 } },
          z: 3,
        }))

      // markLine rides on the first scatter series; keep it even when a
      // session filter leaves a single group.
      if (scatterSeries.length) Object.assign(scatterSeries[0], { markLine })
      series = [ellipseSeries, ...trailSeries, ...scatterSeries]
    }

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
      series,
    }
  }, [shots, ink, sessionSlots, hoverSessionId, symbolOf])

  const onClick = (params: ChartClick) => {
    const d = params.data as DotDatum | undefined
    if (d?.shotId) onToggle(d.shotId, !d.excluded)
  }

  return <EChart option={option} height={300} testId="shot-shape-chart" onClick={onClick} />
}
