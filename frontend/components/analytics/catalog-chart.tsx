'use client'

import {
  Area, AreaChart, Bar, BarChart as RechartsBarChart, CartesianGrid, Cell, Line, LineChart,
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, Pie, PieChart, ZAxis,
} from 'recharts'

type Point = { label: string; value?: number; value2?: number; value3?: number; x?: number; y?: number; low?: number; high?: number }
type Props = { title: string; description?: string; chartType: 'line' | 'pie' | 'scatter' | 'stackedArea' | 'fluctuation' | 'spider' | 'groupedBar' | 'pyramid' | 'frequencyPolygon'; data: Point[]; height?: number; showGrid?: boolean }
const colors = ['#6c4bc1', '#ef8a62', '#39a6a3', '#e1b04a']
const tooltipStyle = { borderRadius: 10, border: '1px solid #ddd5e8', background: '#fff', fontSize: 12 }

export function CatalogChart({ title, description, chartType, data, height = 250, showGrid = true }: Props) {
  const common = { data, margin: { top: 12, right: 18, left: 0, bottom: 8 } }
  const grid = showGrid ? <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e1ef" /> : null
  const bars = chartType === 'pyramid' ? data.map((point) => ({ ...point, value: -(point.value ?? 0) })) : data
  const chart = (() => {
    if (chartType === 'pie') return <PieChart><Tooltip contentStyle={tooltipStyle} /><Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius="72%" label>{data.map((entry, index) => <Cell key={entry.label} fill={colors[index % colors.length]} />)}</Pie></PieChart>
    if (chartType === 'scatter') return <ScatterChart {...common}>{grid}<XAxis type="number" dataKey="x" name="X" /><YAxis type="number" dataKey="y" name="Y" /><ZAxis range={[45, 180]} /><Tooltip contentStyle={tooltipStyle} /><Scatter data={data} fill={colors[0]} /></ScatterChart>
    if (chartType === 'spider') return <RadarChart {...common} cx="50%" cy="50%" outerRadius="72%"><PolarGrid stroke="#e8e1ef" /><PolarAngleAxis dataKey="label" tick={{ fontSize: 11 }} /><PolarRadiusAxis tick={{ fontSize: 10 }} /><Radar dataKey="value" stroke={colors[0]} fill={colors[0]} fillOpacity={0.24} /></RadarChart>
    if (chartType === 'stackedArea') return <AreaChart {...common}>{grid}<XAxis dataKey="label" /><YAxis /><Tooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="value" stackId="1" stroke={colors[0]} fill={colors[0]} fillOpacity={0.72} /><Area type="monotone" dataKey="value2" stackId="1" stroke={colors[1]} fill={colors[1]} fillOpacity={0.72} /></AreaChart>
    if (chartType === 'groupedBar') return <RechartsBarChart {...common} barGap={8}>{grid}<XAxis dataKey="label" /><YAxis /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="value" fill={colors[0]} radius={[5, 5, 0, 0]} /><Bar dataKey="value2" fill={colors[1]} radius={[5, 5, 0, 0]} /></RechartsBarChart>
    if (chartType === 'pyramid') return <RechartsBarChart layout="vertical" {...common} data={bars}><XAxis type="number" tickFormatter={(value) => String(Math.abs(Number(value)))} /><YAxis type="category" dataKey="label" width={80} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => Math.abs(Number(value))} /><Bar dataKey="value" fill={colors[0]} radius={[0, 5, 5, 0]} /></RechartsBarChart>
    if (chartType === 'fluctuation') return <RechartsBarChart {...common}><XAxis dataKey="label" /><YAxis /><ReferenceLine y={0} stroke="#958aa0" />{grid}<Tooltip contentStyle={tooltipStyle} /><Bar dataKey="value" fill={colors[1]} radius={[5, 5, 0, 0]} /></RechartsBarChart>
    if (chartType === 'frequencyPolygon') return <LineChart {...common}>{grid}<XAxis dataKey="label" /><YAxis /><Tooltip contentStyle={tooltipStyle} /><Line type="linear" dataKey="value" stroke={colors[2]} strokeWidth={3} dot={{ r: 4, fill: colors[2] }} /></LineChart>
    return <LineChart {...common}>{grid}<XAxis dataKey="label" /><YAxis /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={3} dot={{ r: 3 }} /></LineChart>
  })()
  return <section className="json-chart-card"><header><h3>{title}</h3>{description && <p>{description}</p>}</header><div className="json-chart-canvas" style={{ height }}><ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer></div></section>
}

export type CatalogChartProps = Props
