'use client'

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
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

const barColors = ['var(--primary)', 'var(--violet)', 'var(--pink)', 'var(--primary)', 'var(--violet)']

function ValueLabel({ x, y, value, orientation }: { x?: number; y?: number; value?: number; orientation: BarChartProps['orientation'] }) {
  if (x === undefined || y === undefined || value === undefined) return null
  return <text x={orientation === 'horizontal' ? x + 8 : x} y={orientation === 'horizontal' ? y + 4 : y - 8} fill="var(--foreground)" textAnchor={orientation === 'horizontal' ? 'start' : 'middle'} fontSize={11} fontWeight={700}>{value}</text>
}

export function BarChart({ title, description, data, xAxisLabel, yAxisLabel, showValues = false, showGrid = true, orientation = 'vertical', height = 320 }: BarChartProps) {
  const horizontal = orientation === 'horizontal'
  if (!data.length) return <section className="json-bar-chart"><header><h3>{title}</h3>{description && <p>{description}</p>}</header><div className="json-bar-chart-empty">No data available</div></section>

  return <section className="json-bar-chart" aria-label={title}>
    <header><h3>{title}</h3>{description && <p>{description}</p>}</header>
    <div className="json-bar-chart-canvas" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 18, right: 18, left: horizontal ? 14 : 4, bottom: 28 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={!horizontal} horizontal={horizontal} />}
          {horizontal ? <><XAxis type="number" axisLine={false} tickLine={false} stroke="var(--muted-foreground)"><Label value={xAxisLabel} position="insideBottom" offset={-18} /></XAxis><YAxis type="category" dataKey="label" axisLine={false} tickLine={false} width={84} stroke="var(--muted-foreground)"><Label value={yAxisLabel} angle={-90} position="insideLeft" /></YAxis></> : <><XAxis dataKey="label" axisLine={false} tickLine={false} stroke="var(--muted-foreground)"><Label value={xAxisLabel} position="insideBottom" offset={-18} /></XAxis><YAxis axisLine={false} tickLine={false} stroke="var(--muted-foreground)"><Label value={yAxisLabel} angle={-90} position="insideLeft" /></YAxis></>}
          <Tooltip cursor={{ fill: 'var(--lavender)', opacity: 0.45 }} contentStyle={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)', color: 'var(--foreground)' }} />
          <Bar dataKey="value" radius={horizontal ? [0, 7, 7, 0] : [7, 7, 0, 0]} isAnimationActive animationDuration={650} label={showValues ? (props) => <ValueLabel x={typeof props.x === 'number' ? props.x : undefined} y={typeof props.y === 'number' ? props.y : undefined} value={typeof props.value === 'number' ? props.value : undefined} orientation={orientation} /> : undefined}>{data.map((item, index) => <Cell key={`${item.label}-${index}`} fill={barColors[index % barColors.length]} />)}</Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  </section>
}
