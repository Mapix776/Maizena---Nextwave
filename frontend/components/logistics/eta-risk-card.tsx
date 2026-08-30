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
  return (
    <article className={`w-full max-w-3xl rounded-2xl border bg-card p-5 text-card-foreground shadow-sm sm:p-6 ${severity === 'critical' ? 'border-destructive/30' : 'border-amber-500/30'}`} aria-label={`ETA risk for ${containerNumber}`}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-start gap-3">
          <span className={`flex size-10 items-center justify-center rounded-xl ${severity === 'critical' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-600'}`}><TriangleAlert aria-hidden="true" /></span>
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">ETA risk</p><h2 className="mt-1 font-mono text-lg font-semibold">{containerNumber}</h2></div>
        </div>
        <strong className={severity === 'critical' ? 'text-destructive' : 'text-amber-700 dark:text-amber-300'}>{slipDays} {slipDays === 1 ? 'day' : 'days'} late</strong>
      </header>

      <div className="my-5 flex flex-wrap items-center gap-3 rounded-xl bg-muted/40 p-4 text-sm">
        <CalendarClock className="size-5 text-muted-foreground" aria-hidden="true" />
        <div><span className="text-xs text-muted-foreground">Original ETA</span><p className="font-medium">{date(originalEta)}</p></div>
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
        <div><span className="text-xs text-muted-foreground">Current ETA</span><p className="font-medium">{date(currentEta)}</p></div>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        {currentLocation && <p className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" aria-hidden="true" />{currentLocation}</p>}
        {currentVessel && <p className="flex items-center gap-2"><Ship className="size-4 text-muted-foreground" aria-hidden="true" />{currentVessel}</p>}
      </div>
    </article>
  )
}
