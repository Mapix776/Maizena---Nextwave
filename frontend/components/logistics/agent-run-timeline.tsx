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

export function AgentRunTimeline({ title, operationReference, runs }: AgentRunTimelineProps) {
  return (
    <article className="w-full max-w-3xl rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6" aria-label={title}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
        <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bot aria-hidden="true" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Automation</p><h2 className="text-lg font-semibold">{title}</h2></div></div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{operationReference}</span>
      </header>
      {runs.length === 0 ? <p className="text-sm text-muted-foreground">No recorded agent runs.</p> : (
        <ol className="space-y-0">
          {runs.map((run, index) => {
            const Icon = run.status === 'completed' ? CheckCircle2 : run.status === 'failed' ? XCircle : CircleDashed
            return (
              <li key={run.id} className="relative flex gap-4 pb-6 last:pb-0">
                {index < runs.length - 1 && <span className="absolute left-4 top-8 h-[calc(100%-0.5rem)] w-px bg-border" aria-hidden="true" />}
                <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background"><Icon className="size-4 text-primary" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1 rounded-xl bg-muted/35 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{run.agentName}</h3><p className="text-sm text-muted-foreground">{humanize(run.flowStep)}</p></div><span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium">{statusLabels[run.status]}</span></div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {run.triggerEvent && <span>Triggered by {humanize(run.triggerEvent)}</span>}
                    {run.tokensUsed !== undefined && <span>{run.tokensUsed} tokens</span>}
                    <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" aria-hidden="true" />{run.updatedAt}</span>
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
