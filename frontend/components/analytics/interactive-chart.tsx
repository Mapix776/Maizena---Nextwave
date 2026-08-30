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

const sliceColors = ['var(--primary)', 'var(--violet)', 'var(--pink)', '#39a6a3', '#e1b04a']
const tooltipStyle = {
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--foreground)',
  fontSize: 12,
}

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
      className="interactive-chart"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      <div className="interactive-chart-toolbar">
        <button
          type="button"
          className="interactive-chart-drag"
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
          <div className="interactive-chart-title-editor">
            <input
              autoFocus
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
            <button type="button" aria-label="Guardar título" onClick={() => setIsEditingTitle(false)}>
              <Check size={15} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="interactive-chart-heading"
            onClick={() => setIsEditingTitle(true)}
            aria-label="Editar título del gráfico"
          >
            <span>{localTitle}</span>
            <PencilLine size={13} aria-hidden="true" />
          </button>
        )}

        <div className="interactive-chart-actions" role="group" aria-label="Tipo de gráfico">
          {chartTypes.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={id === activeType ? 'selected' : undefined}
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
            aria-label="Restablecer posición"
            title="Restablecer posición"
            onClick={() => setPosition({ x: 0, y: 0 })}
          >
            <RotateCcw size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {description && <p className="interactive-chart-description">{description}</p>}

      <div className="interactive-chart-canvas">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            {activeType === 'pie' ? (
              <PieChart>
                <Tooltip contentStyle={tooltipStyle} />
                <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius="76%" label>
                  {data.map((entry, index) => (
                    <Cell key={entry.label} fill={sliceColors[index % sliceColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            ) : activeType === 'line' ? (
              <LineChart data={data} margin={{ top: 12, right: 18, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            ) : (
              <RechartsBarChart data={data} margin={{ top: 12, right: 18, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--lavender)' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={entry.label} fill={sliceColors[index % sliceColors.length]} />
                  ))}
                </Bar>
              </RechartsBarChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="interactive-chart-empty">Sin datos para mostrar</div>
        )}
      </div>
    </section>
  )
}
