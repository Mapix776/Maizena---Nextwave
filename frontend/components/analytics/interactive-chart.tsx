'use client'

import { useRef, useState } from 'react'
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3, Check, LineChart as LineIcon, Move, PencilLine, PieChart as PieIcon, RotateCcw } from 'lucide-react'

type ChartType = 'bar' | 'line' | 'pie'

export type InteractiveChartProps = {
  title: string
  description?: string
  chartType: ChartType
  data: Array<{ label: string; value: number }>
}

// Monochrome ramp anchored on the brand primary so slices stay on-token and
// invert correctly in dark mode (--card flips with the theme).
const sliceColors = [
  'var(--primary)',
  'color-mix(in srgb, var(--primary) 62%, var(--card))',
  'color-mix(in srgb, var(--primary) 38%, var(--card))',
  'color-mix(in srgb, var(--primary) 22%, var(--card))',
]

const axisTick = { fill: 'var(--muted-foreground)', fontSize: 11 }
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

const iconButton = 'grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

const chartTypes: Array<{ id: ChartType; label: string; Icon: typeof BarChart3 }> = [
  { id: 'bar', label: 'Barras', Icon: BarChart3 },
  { id: 'line', label: 'Línea', Icon: LineIcon },
  { id: 'pie', label: 'Circular', Icon: PieIcon },
]

// Presentation-only widget: moving, switching type, and editing the title all
// change local screen state only. No Supabase, Socket.IO, or Ari write tool is
// ever called from here, so operational data is never mutated.
export function InteractiveChart({ title, description, chartType, data }: InteractiveChartProps) {
  const [activeType, setActiveType] = useState<ChartType>(chartType)
  const [localTitle, setLocalTitle] = useState(title)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const dragState = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null)

  function handleDragStart(event: React.PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    }
  }

  function handleDragMove(event: React.PointerEvent<HTMLButtonElement>) {
    const state = dragState.current
    if (!state || state.pointerId !== event.pointerId) return
    setPosition({
      x: state.originX + (event.clientX - state.startX),
      y: state.originY + (event.clientY - state.startY),
    })
  }

  function endDrag() {
    dragState.current = null
  }

  const hasData = data.length > 0

  return (
    <section
      className="relative w-full max-w-full touch-none rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`${iconButton} cursor-grab active:cursor-grabbing active:bg-muted active:text-primary`}
          aria-label="Mover gráfico"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
        >
          <Move size={15} aria-hidden="true" />
        </button>

        {isEditingTitle ? (
          <div className="mr-auto flex min-w-0 items-center gap-2">
            <input
              autoFocus
              className="w-[min(240px,60vw)] min-w-0 rounded-lg border border-input bg-card px-2.5 py-1.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              value={localTitle}
              onChange={(event) => setLocalTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                  setIsEditingTitle(false)
                }
                if (event.key === 'Escape') setIsEditingTitle(false)
              }}
              aria-label="Editar título del gráfico"
            />
            <button
              type="button"
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              aria-label="Guardar título"
              onClick={() => setIsEditingTitle(false)}
            >
              <Check size={15} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="mr-auto flex min-w-0 cursor-text items-center gap-2 rounded-lg px-1.5 py-1 text-base font-semibold tracking-tight text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            onClick={() => setIsEditingTitle(true)}
            aria-label="Editar título del gráfico"
          >
            <span className="truncate">{localTitle}</span>
            <PencilLine size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        )}

        <div className="ml-auto flex flex-wrap gap-1" role="group" aria-label="Tipo de gráfico">
          {chartTypes.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={id === activeType ? `${iconButton} border-primary bg-primary text-primary-foreground hover:border-primary hover:text-primary-foreground` : iconButton}
              aria-pressed={id === activeType}
              aria-label={label}
              title={label}
              onClick={() => setActiveType(id)}
            >
              <Icon size={15} aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            className={iconButton}
            aria-label="Restablecer posición"
            title="Restablecer posición"
            onClick={() => setPosition({ x: 0, y: 0 })}
          >
            <RotateCcw size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {description && <p className="mt-2 px-0.5 text-sm leading-relaxed text-muted-foreground">{description}</p>}

      <div className="mt-4 h-[220px] w-full sm:h-[250px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            {activeType === 'pie' ? (
              <PieChart>
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius="76%" stroke="var(--card)" strokeWidth={2} label={{ fill: 'var(--muted-foreground)', fontSize: 11 }}>
                  {data.map((entry, index) => (
                    <Cell key={entry.label} fill={sliceColors[index % sliceColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            ) : activeType === 'line' ? (
              <LineChart data={data} margin={{ top: 12, right: 18, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} />
                <YAxis axisLine={false} tickLine={false} tick={axisTick} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3, fill: 'var(--primary)', strokeWidth: 0 }} activeDot={{ r: 4 }} />
              </LineChart>
            ) : (
              <RechartsBarChart data={data} margin={{ top: 12, right: 18, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} />
                <YAxis axisLine={false} tickLine={false} tick={axisTick} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} cursor={{ fill: 'var(--muted)', opacity: 0.6 }} />
                <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </RechartsBarChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">Sin datos para mostrar</div>
        )}
      </div>
    </section>
  )
}
