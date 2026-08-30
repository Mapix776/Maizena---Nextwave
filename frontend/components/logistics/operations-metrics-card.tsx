import { AlertTriangle, Boxes, CircleGauge, ClockAlert, Route, ShipWheel } from 'lucide-react'

import type { OperationsMetricsCardProps } from '../../../backend/src/contracts/logistics-ui'

export function OperationsMetricsCard(props: OperationsMetricsCardProps) {
  const maxStatusCount = Math.max(1, ...props.byStatus.map(({ count }) => count))
  const metrics = [
    { label: 'operations', value: props.totalOperations, Icon: Route },
    { label: 'containers', value: props.totalContainers, Icon: Boxes },
    { label: 'in transit', value: props.containersInTransit, Icon: ShipWheel },
    { label: 'in customs', value: props.containersInCustoms, Icon: CircleGauge },
    { label: 'delayed', value: props.delayedContainersCount, Icon: ClockAlert },
    { label: 'critical alerts', value: props.criticalAlertsCount, Icon: AlertTriangle },
  ]

  return (
    <article
      className="w-full max-w-3xl rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs"
      aria-label="Operations metrics"
    >
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Network</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight">Operations metrics</h2>
        </div>
        <span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
          {props.pendingDecisionsCount} pending decisions
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {metrics.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-lg border border-border bg-muted/40 p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              {label}
            </dt>
            <dd aria-label={`${value} ${label}`} className="mt-2 text-lg font-semibold tracking-tight">
              {value} <span className="text-xs font-normal text-muted-foreground">{label}</span>
            </dd>
          </div>
        ))}
      </dl>

      {props.byStatus.length > 0 && (
        <section className="mt-5 border-t border-border pt-4" aria-label="Operations by status">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">By status</h3>
          <div className="mt-3 space-y-3">
            {props.byStatus.map(({ status, count }) => (
              <div key={status} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                <span className="truncate text-xs font-medium">{status.replaceAll('_', ' ')}</span>
                <strong className="text-xs tabular-nums">{count}</strong>
                <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(count / maxStatusCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  )
}
