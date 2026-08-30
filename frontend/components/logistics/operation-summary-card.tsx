import { CalendarClock, MapPin, Package, Ship } from 'lucide-react'

import type { OperationSummaryProps } from '../../../backend/src/contracts/logistics-ui'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}

const customsLightStyles = {
  red: 'bg-destructive/10 text-destructive',
  green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
} as const

export function OperationSummaryCard({
  referenceCode,
  clientName,
  status,
  tags,
  notes,
  containers,
}: OperationSummaryProps) {
  return (
    <article
      className="w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xs"
      aria-label={`Operation ${referenceCode}`}
    >
      <header className="border-b border-border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Operation</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">{referenceCode}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{clientName}</p>
          </div>
          <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {status.replaceAll('_', ' ')}
          </span>
        </div>
        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {notes && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{notes}</p>}
      </header>

      <div className="divide-y divide-border">
        {containers.length === 0 ? (
          <div className="flex items-center gap-2.5 p-5 text-sm text-muted-foreground">
            <Package className="size-4 shrink-0" aria-hidden="true" /> No containers associated yet.
          </div>
        ) : (
          containers.map((container) => (
            <section key={container.id} className="p-5" aria-label={`Container ${container.containerNumber}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Ship className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-mono text-sm font-semibold tracking-tight">{container.containerNumber}</h3>
                    <p className="text-xs text-muted-foreground">{container.status.replaceAll('_', ' ')}</p>
                  </div>
                </div>
                {container.customsLight && (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      customsLightStyles[container.customsLight]
                    }`}
                  >
                    Customs {container.customsLight}
                  </span>
                )}
              </div>
              <div className="mt-4 grid gap-2.5 text-sm sm:grid-cols-2">
                <div className="flex gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>
                    {container.originPort} → {container.destinationPort}
                  </span>
                </div>
                {container.currentLocation && (
                  <div className="flex gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{container.currentLocation}</span>
                  </div>
                )}
                {container.currentVessel && (
                  <div className="flex gap-2">
                    <Ship className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>{container.currentVessel}</span>
                  </div>
                )}
                {container.eta && (
                  <div className="flex gap-2">
                    <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>ETA {formatDate(container.eta)}</span>
                  </div>
                )}
              </div>
            </section>
          ))
        )}
      </div>
    </article>
  )
}
