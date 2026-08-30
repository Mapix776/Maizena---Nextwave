'use client'

import { ChevronRight } from 'lucide-react'
import { useEffect, useId, useReducer } from 'react'

import { ThinkingAnimation } from '@/components/chat/thinking-animation'
import type { WorkTrace, WorkTraceSource } from '@/lib/work-trace'
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

export function openWorkTraceSource(
  source: WorkTraceSource,
  onOpenSource: (source: WorkTraceSource) => void,
) {
  onOpenSource(source)
}

export function WorkTraceDisclosure({
  trace,
  workedForLabel,
  workingLabel,
  sourcesLabel = 'Sources',
  onOpenSource,
}: {
  trace: WorkTrace
  workedForLabel: string
  workingLabel: string
  sourcesLabel?: string
  onOpenSource?: (source: WorkTraceSource) => void
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
        : `${currentStep?.title ?? workingLabel}: not completed`

  useEffect(() => {
    dispatch({ type: 'trace-status', status: trace.status })
  }, [trace.status])

  return (
    <section
      className="mb-4 w-full rounded-2xl border border-border/70 bg-card px-4 shadow-xs last:mb-0"
      data-work-trace
    >
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
                      ? 'Completed'
                      : 'Not completed'}
                </p>
                {step.sources?.length ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2" aria-label={sourcesLabel}>
                    <span className="text-xs font-medium text-muted-foreground">
                      {sourcesLabel}
                    </span>
                    {step.sources.map((source) => (
                      <button
                        key={source.id}
                        type="button"
                        className="min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => onOpenSource && openWorkTraceSource(source, onOpenSource)}
                      >
                        {source.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
