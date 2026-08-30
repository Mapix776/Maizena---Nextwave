'use client'

import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, Gauge } from 'lucide-react'

import type { KpiGridProps } from '../../../backend/src/contracts/ui'
import { requestAriPrompt } from '@/lib/ari-ui-events'

const PENDING_DECISIONS_PROMPT =
  'Show me my pending decisions and let me review and resolve them one at a time.'

const severityStyles = {
  normal: 'border-border bg-muted/40',
  warning: 'border-amber-500/25 bg-amber-500/10',
  critical: 'border-destructive/25 bg-destructive/10',
} as const

const severityValueStyles = {
  normal: 'text-foreground',
  warning: 'text-amber-700 dark:text-amber-300',
  critical: 'text-destructive',
} as const

const trendIcons = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  neutral: ArrowRight,
} as const

export function KpiGrid({ title, metrics }: KpiGridProps) {
  return (
    <article
      className="w-full max-w-3xl rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs"
      aria-label={title}
    >
      <header className="mb-4 flex items-center gap-3 border-b border-border pb-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
          <Gauge className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Key performance indicators</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight">{title}</h2>
        </div>
      </header>

      <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const TrendIcon = metric.trend ? trendIcons[metric.trend] : null
          const isPendingDecisions =
            metric.id === 'decisions' &&
            (typeof metric.value === 'number'
              ? metric.value > 0
              : Number(metric.value) > 0)

          return (
            <div key={metric.id} className={`rounded-lg border p-3.5 ${severityStyles[metric.severity]}`}>
              <dt className="text-xs font-medium text-muted-foreground">{metric.label}</dt>
              <dd className={`mt-2 flex flex-wrap items-baseline gap-1.5 ${severityValueStyles[metric.severity]}`}>
                <strong className="text-xl font-semibold tracking-tight tabular-nums">{metric.value}</strong>
                {metric.unit && <span className="text-xs font-medium">{metric.unit}</span>}
                {TrendIcon && <TrendIcon className="ml-auto size-4 self-center" aria-label={`${metric.trend} trend`} />}
              </dd>
              {metric.subtext && <p className="mt-2 text-xs leading-5 text-muted-foreground">{metric.subtext}</p>}
              {isPendingDecisions && (
                <button
                  type="button"
                  onClick={() => requestAriPrompt(PENDING_DECISIONS_PROMPT)}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-destructive underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Review ${metric.value} pending decisions`}
                >
                  Review decisions
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          )
        })}
      </dl>
    </article>
  )
}
