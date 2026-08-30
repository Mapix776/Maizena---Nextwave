import { AlertCircle, AlertTriangle, BellRing, CircleCheck } from 'lucide-react'

import type { OperationalAlertListProps } from '../../../backend/src/contracts/logistics-ui'

const severityStyles = {
  normal: 'border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-300',
  warning: 'border-amber-500/25 bg-amber-500/5 text-amber-700 dark:text-amber-300',
  critical: 'border-destructive/25 bg-destructive/5 text-destructive',
}

const severityIcons = {
  normal: AlertCircle,
  warning: AlertTriangle,
  critical: BellRing,
}

export function OperationalAlertList({
  title,
  operationReference,
  alerts,
}: OperationalAlertListProps) {
  return (
    <article className="w-full max-w-3xl rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6" aria-label={title}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Attention</p>
          <h2 className="mt-1 text-lg font-semibold">{title}</h2>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{operationReference}</span>
      </header>
      {alerts.length === 0 ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <CircleCheck className="size-5 text-emerald-600" aria-hidden="true" /> No active alerts.
        </div>
      ) : (
        <ol className="space-y-3">
          {alerts.map((alert) => {
            const Icon = severityIcons[alert.severity]
            return (
              <li key={alert.id} className={`rounded-xl border p-4 ${severityStyles[alert.severity]}`}>
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-card-foreground">{alert.title}</h3>
                      <span className="text-xs font-semibold">{alert.severity[0].toUpperCase() + alert.severity.slice(1)}</span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.message}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-background/70 px-2.5 py-1 text-muted-foreground">{alert.category.replaceAll('_', ' ')}</span>
                      <span className="rounded-full bg-background/70 px-2.5 py-1 text-muted-foreground">{alert.acknowledged ? 'Acknowledged' : 'Unacknowledged'}</span>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </article>
  )
}
