import { Anchor, MapPin, Route, Ship } from 'lucide-react'

import type { ShipmentMilestoneTimelineProps } from '../../../backend/src/contracts/logistics-ui'

function date(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}

export function ShipmentMilestoneTimeline({
  containerNumber,
  originPort,
  destinationPort,
  milestones,
}: ShipmentMilestoneTimelineProps) {
  const latestIndex = milestones.length - 1

  return (
    <article
      className="w-full max-w-3xl rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs"
      aria-label={`Shipment milestones for ${containerNumber}`}
    >
      <header className="mb-5 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Route className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Observed route</p>
            <h2 className="mt-1 font-mono text-base font-semibold tracking-tight">{containerNumber}</h2>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <Anchor className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{originPort}</span>
          <span className="text-muted-foreground">→</span>
          <span>{destinationPort}</span>
        </div>
      </header>

      <ol>
        {milestones.map((milestone, index) => {
          const isLatest = index === latestIndex
          return (
            <li key={`${milestone.at}-${milestone.status}`} className="relative flex gap-3 pb-5 last:pb-0">
              {index < latestIndex && (
                <span className="absolute bottom-0 left-3.5 top-8 w-px bg-border" aria-hidden="true" />
              )}
              <span
                className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border ${
                  isLatest ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'
                }`}
              >
                {milestone.status === 'IN_TRANSIT' ? (
                  <Ship className="size-3.5" aria-hidden="true" />
                ) : (
                  <MapPin className="size-3.5" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 pt-0.5">
                <h3 className="text-sm font-semibold tracking-tight">{milestone.status.replaceAll('_', ' ')}</h3>
                {milestone.location && <p className="mt-0.5 text-sm text-muted-foreground">{milestone.location}</p>}
                <time className="mt-1 block text-xs text-muted-foreground">{date(milestone.at)}</time>
              </div>
            </li>
          )
        })}
      </ol>
    </article>
  )
}
