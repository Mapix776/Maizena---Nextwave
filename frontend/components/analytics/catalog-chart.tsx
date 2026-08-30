'use client'

import { ChartColumn, ChartLine, ChartPie, ChartScatter, Radar as RadarIcon } from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart as RechartsBarChart, CartesianGrid, Cell, Line, LineChart,
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, Pie, PieChart, ZAxis,
} from 'recharts'

type Point = { label: string; value?: number; value2?: number; value3?: number; x?: number; y?: number; low?: number; high?: number }
type Props = { title: string; description?: string; chartType: 'line' | 'pie' | 'scatter' | 'stackedArea' | 'fluctuation' | 'spider' | 'groupedBar' | 'pyramid' | 'frequencyPolygon'; data: Point[]; height?: number; showGrid?: boolean }

// Monochrome ramp anchored on the brand primary so every series stays on-token
// and inverts correctly in dark mode (--card flips with the theme).
const series = [
  'var(--primary)',
  'color-mix(in srgb, var(--primary) 62%, var(--card))',
  'color-mix(in srgb, var(--primary) 38%, var(--card))',
  'color-mix(in srgb, var(--primary) 22%, var(--card))',
]

const axisTick = { fill: 'var(--muted-foreground)', fontSize: 11 }
const axisProps = { axisLine: false, tickLine: false, tick: axisTick } as const

const tooltipStyle = {
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

const chartIcons: Record<Props['chartType'], typeof ChartColumn> = {
  line: ChartLine,
  pie: ChartPie,
  scatter: ChartScatter,
  stackedArea: ChartLine,
  fluctuation: ChartColumn,
  spider: RadarIcon,
  groupedBar: ChartColumn,
  pyramid: ChartColumn,
  frequencyPolygon: ChartLine,
}

export function CatalogChart({ title, description, chartType, data, height = 250, showGrid = true }: Props) {
  const common = { data, margin: { top: 12, right: 18, left: 0, bottom: 8 } }
  const grid = showGrid ? <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" /> : null
  const tip = <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} cursor={{ fill: 'var(--muted)', opacity: 0.6, stroke: 'var(--border)' }} />
  const bars = chartType === 'pyramid' ? data.map((point) => ({ ...point, value: -(point.value ?? 0) })) : data
  const Icon = chartIcons[chartType] ?? ChartColumn

  const chart = (() => {
    if (chartType === 'pie') return <PieChart>{tip}<Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius="72%" stroke="var(--card)" strokeWidth={2} label={{ fill: 'var(--muted-foreground)', fontSize: 11 }}>{data.map((entry, index) => <Cell key={entry.label} fill={series[index % series.length]} />)}</Pie></PieChart>
    if (chartType === 'scatter') return <ScatterChart {...common}>{grid}<XAxis type="number" dataKey="x" name="X" {...axisProps} /><YAxis type="number" dataKey="y" name="Y" {...axisProps} /><ZAxis range={[45, 180]} />{tip}<Scatter data={data} fill={series[0]} /></ScatterChart>
    if (chartType === 'spider') return <RadarChart {...common} cx="50%" cy="50%" outerRadius="72%"><PolarGrid stroke="var(--border)" /><PolarAngleAxis dataKey="label" tick={axisTick} /><PolarRadiusAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} /><Radar dataKey="value" stroke={series[0]} fill={series[0]} fillOpacity={0.2} /></RadarChart>
    if (chartType === 'stackedArea') return <AreaChart {...common}>{grid}<XAxis dataKey="label" {...axisProps} /><YAxis {...axisProps} />{tip}<Area type="monotone" dataKey="value" stackId="1" stroke={series[0]} fill={series[0]} fillOpacity={0.65} /><Area type="monotone" dataKey="value2" stackId="1" stroke={series[2]} fill={series[2]} fillOpacity={0.65} /></AreaChart>
    if (chartType === 'groupedBar') return <RechartsBarChart {...common} barGap={8}>{grid}<XAxis dataKey="label" {...axisProps} /><YAxis {...axisProps} />{tip}<Bar dataKey="value" fill={series[0]} radius={[5, 5, 0, 0]} /><Bar dataKey="value2" fill={series[2]} radius={[5, 5, 0, 0]} /></RechartsBarChart>
    if (chartType === 'pyramid') return <RechartsBarChart layout="vertical" {...common} data={bars}><XAxis type="number" tickFormatter={(value) => String(Math.abs(Number(value)))} {...axisProps} /><YAxis type="category" dataKey="label" width={80} {...axisProps} /><Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} cursor={{ fill: 'var(--muted)', opacity: 0.6 }} formatter={(value) => Math.abs(Number(value))} /><Bar dataKey="value" fill={series[0]} radius={[0, 5, 5, 0]} /></RechartsBarChart>
    if (chartType === 'fluctuation') return <RechartsBarChart {...common}><XAxis dataKey="label" {...axisProps} /><YAxis {...axisProps} /><ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />{grid}{tip}<Bar dataKey="value" fill={series[0]} radius={[5, 5, 0, 0]} /></RechartsBarChart>
    if (chartType === 'frequencyPolygon') return <LineChart {...common}>{grid}<XAxis dataKey="label" {...axisProps} /><YAxis {...axisProps} />{tip}<Line type="linear" dataKey="value" stroke={series[0]} strokeWidth={2} dot={{ r: 3, fill: series[0], strokeWidth: 0 }} activeDot={{ r: 4 }} /></LineChart>
    return <LineChart {...common}>{grid}<XAxis dataKey="label" {...axisProps} /><YAxis {...axisProps} />{tip}<Line type="monotone" dataKey="value" stroke={series[0]} strokeWidth={2} dot={{ r: 3, fill: series[0], strokeWidth: 0 }} activeDot={{ r: 4 }} /></LineChart>
  })()

  return (
    <section className="w-full rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs" aria-label={title}>
      <header className="mb-4 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </header>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>
      </div>
    </section>
  )
}

export type CatalogChartProps = Props
