'use client'

import { ChevronRight } from 'lucide-react'
import { useEffect, useId, useReducer } from 'react'

import { ThinkingAnimation } from '@/components/chat/thinking-animation'
import type { WorkTrace } from '@/lib/work-trace'
import {
  createDisclosureState,
  reduceDisclosureState,
  selectAnimatedStepId,
} from '@/lib/work-trace-disclosure'

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
  workingLabel,
}: {
  trace: WorkTrace
  workedForLabel: string
  workingLabel: string
}) {
  const [disclosure, dispatch] = useReducer(
    reduceDisclosureState,
    trace.status,
    createDisclosureState,
  )
  const panelId = useId()
  const animatedStepId = selectAnimatedStepId(trace.steps)
  const currentStep =
    trace.steps.find(({ id }) => id === animatedStepId) ?? trace.steps.at(-1)
  const announcement =
    trace.status === 'running'
      ? `${workingLabel}: ${currentStep?.title ?? workingLabel}`
      : trace.status === 'completed'
        ? `${workedForLabel} ${formatWorkDuration(trace.durationMs)}`
        : `${currentStep?.title ?? workingLabel}: no completado`

  useEffect(() => {
    dispatch({ type: 'trace-status', status: trace.status })
  }, [trace.status])

  return (
    <section className="mb-4 w-full border-b border-border/70" data-work-trace>
      <button
        type="button"
        className="flex min-h-11 w-full items-center gap-2 py-2 text-left font-mono text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-expanded={disclosure.open}
        aria-controls={panelId}
        onClick={() => dispatch({ type: 'manual-toggle' })}
      >
        <span className="min-w-0 truncate">
          {trace.status === 'running'
            ? workingLabel
            : `${workedForLabel} ${formatWorkDuration(trace.durationMs)}`}
        </span>
        <ChevronRight
          className={`ml-auto size-3.5 shrink-0 transition-transform ${disclosure.open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
      </button>
      <span className="sr-only" role="status" aria-atomic="true">
        {announcement}
      </span>
      <div id={panelId} hidden={!disclosure.open}>
        <ol className="space-y-4 pb-5 pt-2">
          {trace.steps.map((step) => (
            <li key={step.id} className="flex min-h-11 items-start gap-3 pl-1">
              {step.id === animatedStepId ? (
                <div className="scale-[0.44] -m-7 shrink-0" aria-hidden="true">
                  <ThinkingAnimation type={step.animationType} />
                </div>
              ) : (
                <span
                  className="mt-1 grid size-5 shrink-0 place-items-center rounded-full border border-border text-[10px] text-muted-foreground"
                  aria-hidden="true"
                >
                  {step.status === 'completed'
                    ? '✓'
                    : step.status === 'failed'
                      ? '!'
                      : '•'}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {step.detail}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {step.status === 'running'
                    ? workingLabel
                    : step.status === 'completed'
                      ? 'Completado'
                      : 'No completado'}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
