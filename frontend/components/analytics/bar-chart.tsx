'use client'

import { ChartColumn } from 'lucide-react'
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Label,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type BarChartDatum = { label: string; value: number }

export type BarChartProps = {
  title: string
  description?: string
  data: BarChartDatum[]
  xAxisLabel?: string
  yAxisLabel?: string
  showValues?: boolean
  showGrid?: boolean
  orientation?: 'vertical' | 'horizontal'
  height?: number
}

const axisTick = { fill: 'var(--muted-foreground)', fontSize: 11 }
const axisLabel = { fill: 'var(--muted-foreground)', fontSize: 11 }

const tooltipContentStyle = {
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--popover)',
  color: 'var(--popover-foreground)',
  boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.06)',
  fontSize: 12,
  padding: '8px 10px',
}
const tooltipLabelStyle = { color: 'var(--popover-foreground)', fontWeight: 600, marginBottom: 2 }
const tooltipItemStyle = { color: 'var(--muted-foreground)', fontSize: 12 }

function ValueLabel({ x, y, value, orientation }: { x?: number; y?: number; value?: number; orientation: BarChartProps['orientation'] }) {
  if (x === undefined || y === undefined || value === undefined) return null
  return <text x={orientation === 'horizontal' ? x + 8 : x} y={orientation === 'horizontal' ? y + 4 : y - 8} fill="var(--muted-foreground)" textAnchor={orientation === 'horizontal' ? 'start' : 'middle'} fontSize={11} fontWeight={600}>{value}</text>
}

function ChartHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-4 flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <ChartColumn className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
    </header>
  )
}

export function BarChart({ title, description, data, xAxisLabel, yAxisLabel, showValues = false, showGrid = true, orientation = 'vertical', height = 320 }: BarChartProps) {
  const horizontal = orientation === 'horizontal'

  if (!data.length) {
    return (
      <section className="w-full rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs">
        <ChartHeader title={title} description={description} />
        <div className="grid min-h-[180px] place-items-center text-sm text-muted-foreground">No data available</div>
      </section>
    )
  }

  return (
    <section className="w-full rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs" aria-label={title}>
      <ChartHeader title={title} description={description} />
      <div className="min-h-[180px] w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 18, right: 18, left: horizontal ? 14 : 4, bottom: 28 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={!horizontal} horizontal={horizontal} />}
            {horizontal ? (
              <>
                <XAxis type="number" axisLine={false} tickLine={false} tick={axisTick}>
                  <Label value={xAxisLabel} position="insideBottom" offset={-18} style={axisLabel} />
                </XAxis>
                <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} width={84} tick={axisTick}>
                  <Label value={yAxisLabel} angle={-90} position="insideLeft" style={axisLabel} />
                </YAxis>
              </>
            ) : (
              <>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick}>
                  <Label value={xAxisLabel} position="insideBottom" offset={-18} style={axisLabel} />
                </XAxis>
                <YAxis axisLine={false} tickLine={false} tick={axisTick}>
                  <Label value={yAxisLabel} angle={-90} position="insideLeft" style={axisLabel} />
                </YAxis>
              </>
            )}
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
              contentStyle={tooltipContentStyle}
              labelStyle={tooltipLabelStyle}
              itemStyle={tooltipItemStyle}
            />
            <Bar
              dataKey="value"
              fill="var(--primary)"
              radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
              isAnimationActive
              animationDuration={650}
              label={showValues ? (props) => <ValueLabel x={typeof props.x === 'number' ? props.x : undefined} y={typeof props.y === 'number' ? props.y : undefined} value={typeof props.value === 'number' ? props.value : undefined} orientation={orientation} /> : undefined}
            />
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
