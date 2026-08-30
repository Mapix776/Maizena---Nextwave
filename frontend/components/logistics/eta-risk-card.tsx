import { ArrowRight, CalendarClock, MapPin, Ship, TriangleAlert } from 'lucide-react'

import type { EtaRiskCardProps } from '../../../backend/src/contracts/logistics-ui'

function date(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

export function EtaRiskCard({
  containerNumber,
  originalEta,
  currentEta,
  slipDays,
  severity,
  currentLocation,
  currentVessel,
}: EtaRiskCardProps) {
  const critical = severity === 'critical'
  const accent = critical
    ? 'bg-destructive/10 text-destructive'
    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'

  return (
    <article
      className="w-full max-w-3xl rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs"
      aria-label={`ETA risk for ${containerNumber}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
            <TriangleAlert className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ETA risk</p>
            <h2 className="mt-1 font-mono text-base font-semibold tracking-tight">{containerNumber}</h2>
          </div>
        </div>
        <strong className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${accent}`}>
          {slipDays} {slipDays === 1 ? 'day' : 'days'} late
        </strong>
      </header>

      <div className="my-5 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-4">
        <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <span className="text-xs text-muted-foreground">Original ETA</span>
          <p className="text-sm font-medium">{date(originalEta)}</p>
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <span className="text-xs text-muted-foreground">Current ETA</span>
          <p className="text-sm font-medium">{date(currentEta)}</p>
        </div>
      </div>

      <div className="grid gap-2.5 text-sm sm:grid-cols-2">
        {currentLocation && (
          <p className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {currentLocation}
          </p>
        )}
        {currentVessel && (
          <p className="flex items-center gap-2">
            <Ship className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {currentVessel}
          </p>
        )}
      </div>
    </article>
  )
}
