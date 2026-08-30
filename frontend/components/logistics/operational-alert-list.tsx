import { AlertCircle, AlertTriangle, BellRing, CircleCheck } from 'lucide-react'

import type { OperationalAlertListProps } from '../../../backend/src/contracts/logistics-ui'

const severityStyles = {
  normal: {
    icon: 'text-muted-foreground',
    badge: 'border border-border bg-muted text-muted-foreground',
  },
  warning: {
    icon: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  critical: {
    icon: 'text-destructive',
    badge: 'bg-destructive/10 text-destructive',
  },
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
    <article
      className="w-full max-w-3xl rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs"
      aria-label={title}
    >
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Attention</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight">{title}</h2>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
          {operationReference}
        </span>
      </header>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span>No active alerts.</span>
        </div>
      ) : (
        <ol className="space-y-2.5">
          {alerts.map((alert) => {
            const Icon = severityIcons[alert.severity]
            const style = severityStyles[alert.severity]
            return (
              <li key={alert.id} className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${style.icon}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold tracking-tight">{alert.title}</h3>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
                        {alert.severity[0].toUpperCase() + alert.severity.slice(1)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{alert.message}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-full border border-border bg-background px-2 py-0.5 text-muted-foreground">
                        {alert.category.replaceAll('_', ' ')}
                      </span>
                      <span className="rounded-full border border-border bg-background px-2 py-0.5 text-muted-foreground">
                        {alert.acknowledged ? 'Acknowledged' : 'Unacknowledged'}
                      </span>
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
