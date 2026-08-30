import type { ReactNode } from 'react'
import { Clock, Ship, Truck, MapPin, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react'
import { Delivery, formatDeliveryDate } from './types'

export function DeliveryCard({ delivery, children }: { delivery: Delivery; children?: ReactNode }) {
  const TransportIcon = delivery.transportType === 'Sea' ? Ship : Truck

  const isDelivered = delivery.status === 'Delivered'
  const isCustoms = delivery.status === 'Customs'
  const isDelayed = delivery.deliveryTime.toLowerCase().includes('delay') || delivery.deliveryTime.toLowerCase().includes('slip')

  const statusStyles = isDelivered
    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : isCustoms
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
      : 'border-primary/25 bg-primary/10 text-primary'

  return (
    <article className="my-3 flex w-full max-w-3xl flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs">
      {/* Header with ID and Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Shipment Overview
          </p>
          <h2 className="mt-1 truncate text-base font-semibold tracking-tight">
            {delivery.id}
          </h2>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles}`}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {delivery.status}
        </span>
      </div>

      {/* ETA row */}
      <div className="flex items-center justify-between gap-3 rounded-sm border border-primary/20 bg-primary/5 p-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
            <Clock className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Estimated Time of Arrival (ETA)
            </p>
            <p className="mt-0.5 text-sm font-semibold">
              {delivery.deliveryTime}
            </p>
          </div>
        </div>
        {isDelayed && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            <AlertCircle className="size-3.5" aria-hidden="true" /> Delay Reported
          </span>
        )}
      </div>

      {/* Origin -> Destination Route */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-sm border border-border bg-muted/40 p-3.5">
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <MapPin className="size-3" aria-hidden="true" /> Origin
          </span>
          <span className="mt-1 truncate text-sm font-medium">
            {delivery.from}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center px-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <TransportIcon className="size-4" aria-hidden="true" />
          </span>
          <ArrowRight className="mt-1 size-3 text-muted-foreground" aria-hidden="true" />
        </div>

        <div className="flex min-w-0 flex-col text-right">
          <span className="flex items-center justify-end gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Destination <MapPin className="size-3" aria-hidden="true" />
          </span>
          <span className="mt-1 truncate text-sm font-medium">
            {delivery.to}
          </span>
        </div>
      </div>

      {/* Meta Specs */}
      <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs sm:grid-cols-3">
        <div>
          <span className="text-muted-foreground">Transport Mode</span>
          <p className="mt-0.5 font-medium text-foreground">{delivery.transportType} Freight</p>
        </div>
        <div>
          <span className="text-muted-foreground">Initiated Date</span>
          <p className="mt-0.5 font-medium text-foreground">{formatDeliveryDate(delivery.createdAt)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Verification</span>
          <p className="mt-0.5 flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="size-3.5" aria-hidden="true" /> Blockchain &amp; Live DB
          </p>
        </div>
      </div>

      {children && <div className="border-t border-border pt-3">{children}</div>}
    </article>
  )
}
