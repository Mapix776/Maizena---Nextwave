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
    <article className="w-full max-w-3xl rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6" aria-label="Operations metrics">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Network</p><h2 className="mt-1 text-lg font-semibold">Operations metrics</h2></div><span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">{props.pendingDecisionsCount} pending decisions</span></header>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metrics.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-xl bg-muted/40 p-4"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-4" aria-hidden="true" />{label}</dt><dd aria-label={`${value} ${label}`} className="mt-2 text-xl font-semibold">{value} <span className="text-sm font-normal text-muted-foreground">{label}</span></dd></div>
        ))}
      </dl>
      {props.byStatus.length > 0 && (
        <section className="mt-5 border-t border-border pt-5" aria-label="Operations by status">
          <h3 className="text-sm font-semibold">By status</h3>
          <div className="mt-4 space-y-3">
            {props.byStatus.map(({ status, count }) => (
              <div key={status} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 text-xs"><span className="font-medium">{status.replaceAll('_', ' ')}</span><strong>{count}</strong><div className="col-span-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(count / maxStatusCount) * 100}%` }} /></div></div>
            ))}
          </div>
        </section>
      )}
    </article>
  )
}
