'use client'

import { ChevronRight } from 'lucide-react'
import { useId, useState } from 'react'

import type { WorkTrace } from '@/lib/work-trace'

export function formatWorkDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1_000))
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []

  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)

  return parts.join(' ')
}

export function WorkTraceDisclosure({
  trace,
  workedForLabel,
}: {
  trace: WorkTrace
  workedForLabel: string
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <section className="mb-4 w-full border-b border-border/70" data-work-trace>
      <button
        type="button"
        className="flex min-h-11 w-full items-center gap-2 py-2 text-left font-mono text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0 truncate">
          {workedForLabel} {formatWorkDuration(trace.durationMs)}
        </span>
        <ChevronRight
          className={`ml-auto size-3.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div id={panelId} hidden={!open}>
        <ol className="space-y-4 pb-5 pt-2">
          {trace.steps.map((step) => (
            <li key={step.id} className="pl-1">
              <p className="text-sm font-medium text-foreground">{step.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {step.detail}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
