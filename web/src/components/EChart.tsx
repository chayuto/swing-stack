import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { LineChart, ScatterChart, CustomChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'

echarts.use([LineChart, ScatterChart, CustomChart, GridComponent, TooltipComponent, CanvasRenderer])

interface Props {
  option: EChartsCoreOption
  height: number
  testId?: string
}

export function EChart({ option, height, testId }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.EChartsType | null>(null)

  useEffect(() => {
    const host = hostRef.current!
    const chart = echarts.init(host)
    chartRef.current = chart
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
