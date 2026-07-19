import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { LineChart, ScatterChart, CustomChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'

echarts.use([
  LineChart,
  ScatterChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  MarkAreaComponent,
  GraphicComponent,
  CanvasRenderer,
])

export interface ChartClick {
  data?: unknown
  seriesIndex?: number
}

interface Props {
  option: EChartsCoreOption
  height: number
  testId?: string
  onClick?: (params: ChartClick) => void
}

export function EChart({ option, height, testId, onClick }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.EChartsType | null>(null)
  const clickRef = useRef(onClick)
  clickRef.current = onClick

  useEffect(() => {
    const host = hostRef.current!
    const chart = echarts.init(host)
    chartRef.current = chart
    chart.on('click', (params) => clickRef.current?.(params as ChartClick))
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(host)
    return () => {
      ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true })
  }, [option])

  return <div ref={hostRef} style={{ height }} data-testid={testId} />
}
