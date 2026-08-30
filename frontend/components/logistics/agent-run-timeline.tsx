import { Bot, CheckCircle2, CircleDashed, Clock3, XCircle } from 'lucide-react'

import type { AgentRunTimelineProps } from '../../../backend/src/contracts/logistics-ui'

const statusLabels = {
  active: 'Active',
  running: 'Running',
  waiting_input: 'Waiting for input',
  waiting_decision: 'Waiting for decision',
  completed: 'Completed',
  failed: 'Failed',
}

function humanize(value: string) {
  return value.replaceAll('_', ' ')
}

function nodeStyle(status: keyof typeof statusLabels) {
  if (status === 'completed') return 'border-primary/30 bg-primary/10 text-primary'
  if (status === 'failed') return 'border-destructive/30 bg-destructive/10 text-destructive'
  return 'border-border bg-background text-muted-foreground'
}

export function AgentRunTimeline({ title, operationReference, runs }: AgentRunTimelineProps) {
  return (
    <article
      className="w-full max-w-3xl rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs"
      aria-label={title}
    >
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Automation</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">{title}</h2>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
          {operationReference}
        </span>
      </header>

      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recorded agent runs.</p>
      ) : (
        <ol>
          {runs.map((run, index) => {
            const Icon = run.status === 'completed' ? CheckCircle2 : run.status === 'failed' ? XCircle : CircleDashed
            return (
              <li key={run.id} className="relative flex gap-3 pb-5 last:pb-0">
                {index < runs.length - 1 && (
                  <span className="absolute bottom-0 left-3.5 top-8 w-px bg-border" aria-hidden="true" />
                )}
                <span
                  className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border ${nodeStyle(run.status)}`}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold tracking-tight">{run.agentName}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">{humanize(run.flowStep)}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {statusLabels[run.status]}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {run.triggerEvent && <span>Triggered by {humanize(run.triggerEvent)}</span>}
                    {run.tokensUsed !== undefined && <span>{run.tokensUsed} tokens</span>}
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
                      {run.updatedAt}
                    </span>
                  </div>
                  {run.errorMessage && <p className="mt-3 text-sm text-destructive">{run.errorMessage}</p>}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </article>
  )
}
