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
  return (
    <article className="w-full max-w-3xl rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6" aria-label={`Shipment milestones for ${containerNumber}`}>
      <header className="mb-5 border-b border-border pb-5">
        <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Route aria-hidden="true" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Observed route</p><h2 className="font-mono text-lg font-semibold">{containerNumber}</h2></div></div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm"><Anchor className="size-4 text-muted-foreground" aria-hidden="true" /><span>{originPort}</span><span className="text-muted-foreground">→</span><span>{destinationPort}</span></div>
      </header>
      <ol>
        {milestones.map((milestone, index) => (
          <li key={`${milestone.at}-${milestone.status}`} className="relative flex gap-4 pb-6 last:pb-0">
            {index < milestones.length - 1 && <span className="absolute left-4 top-8 h-[calc(100%-0.5rem)] w-px bg-primary/30" aria-hidden="true" />}
            <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-background text-primary">{milestone.status === 'IN_TRANSIT' ? <Ship className="size-4" aria-hidden="true" /> : <MapPin className="size-4" aria-hidden="true" />}</span>
            <div className="pt-0.5"><h3 className="text-sm font-semibold">{milestone.status.replaceAll('_', ' ')}</h3>{milestone.location && <p className="mt-1 text-sm text-muted-foreground">{milestone.location}</p>}<time className="mt-1 block text-xs text-muted-foreground">{date(milestone.at)}</time></div>
          </li>
        ))}
      </ol>
    </article>
  )
}
