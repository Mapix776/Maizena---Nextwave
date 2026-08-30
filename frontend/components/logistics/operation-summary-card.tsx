import { CalendarClock, MapPin, Package, Ship } from 'lucide-react'

import type { OperationSummaryProps } from '../../../backend/src/contracts/logistics-ui'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}

export function OperationSummaryCard({
  referenceCode,
  clientName,
  status,
  tags,
  notes,
  containers,
}: OperationSummaryProps) {
  return (
    <article className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm" aria-label={`Operation ${referenceCode}`}>
      <header className="border-b border-border p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Operation</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{referenceCode}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{clientName}</p>
          </div>
          <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {status.replaceAll('_', ' ')}
          </span>
        </div>
        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{tag}</span>)}
          </div>
        )}
        {notes && <p className="mt-4 text-sm leading-6 text-muted-foreground">{notes}</p>}
      </header>

      <div className="divide-y divide-border">
        {containers.length === 0 ? (
          <div className="flex items-center gap-3 p-5 text-sm text-muted-foreground sm:p-6">
            <Package className="size-5" aria-hidden="true" /> No containers associated yet.
          </div>
        ) : containers.map((container) => (
          <section key={container.id} className="p-5 sm:p-6" aria-label={`Container ${container.containerNumber}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Ship className="size-5" aria-hidden="true" /></span>
                <div>
                  <h3 className="font-mono text-sm font-semibold">{container.containerNumber}</h3>
                  <p className="text-xs text-muted-foreground">{container.status.replaceAll('_', ' ')}</p>
                </div>
              </div>
              {container.customsLight && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${container.customsLight === 'red' ? 'bg-destructive/10 text-destructive' : container.customsLight === 'green' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>Customs {container.customsLight}</span>}
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span>{container.originPort} → {container.destinationPort}</span></div>
              {container.currentLocation && <div className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><span>{container.currentLocation}</span></div>}
              {container.currentVessel && <div className="flex gap-2"><Ship className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span>{container.currentVessel}</span></div>}
              {container.eta && <div className="flex gap-2"><CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span>ETA {formatDate(container.eta)}</span></div>}
            </div>
          </section>
        ))}
      </div>
    </article>
  )
}
