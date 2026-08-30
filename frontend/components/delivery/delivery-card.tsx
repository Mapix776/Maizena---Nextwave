import type { ReactNode } from 'react'
import { Clock, Ship, Truck, MapPin, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react'
import { Delivery, formatDeliveryDate } from './types'

export function DeliveryCard({ delivery, children }: { delivery: Delivery; children?: ReactNode }) {
  const TransportIcon = delivery.transportType === 'Sea' ? Ship : Truck

  const isDelivered = delivery.status === 'Delivered'
  const isCustoms = delivery.status === 'Customs'
  const isDelayed = delivery.deliveryTime.toLowerCase().includes('delay') || delivery.deliveryTime.toLowerCase().includes('slip')

  return (
    <article className="my-3 flex flex-col gap-4 rounded-2xl border border-purple-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 text-zinc-900 dark:text-zinc-100 shadow-md transition-all hover:shadow-lg">
      {/* Header with ID and Status */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-md">
            Shipment Overview
          </span>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white mt-1">
            {delivery.id}
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
            isDelivered
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : isCustoms
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
          }`}
        >
          <span className="size-1.5 rounded-full bg-current animate-pulse" />
          {delivery.status}
        </span>
      </div>

      {/* HIGHLIGHTED ETA HERO BANNER */}
      <div className="rounded-xl border border-purple-200 dark:border-purple-900/60 bg-gradient-to-r from-purple-50/80 via-indigo-50/60 to-purple-50/80 dark:from-purple-950/40 dark:via-zinc-900 dark:to-purple-950/40 p-4 flex items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Clock className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
              Estimated Time of Arrival (ETA)
            </p>
            <p className="text-base font-extrabold text-zinc-900 dark:text-white">
              {delivery.deliveryTime}
            </p>
          </div>
        </div>
        {isDelayed && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-800 shrink-0">
            <AlertCircle className="size-3.5" /> Delay Reported
          </span>
        )}
      </div>

      {/* Origin -> Destination Route */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/40 p-3.5">
        <div className="flex flex-col">
          <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            <MapPin className="size-3 text-zinc-400" /> Origin
          </span>
          <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
            {delivery.from}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center px-2">
          <div className="size-8 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 flex items-center justify-center shadow-xs">
            <TransportIcon className="size-4" />
          </div>
          <ArrowRight className="size-3 text-zinc-400 mt-1" />
        </div>

        <div className="flex flex-col text-right">
          <span className="flex items-center justify-end gap-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Destination <MapPin className="size-3 text-purple-500" />
          </span>
          <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
            {delivery.to}
          </span>
        </div>
      </div>

      {/* Meta Specs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-zinc-100 dark:border-zinc-800/80 pt-3 text-xs">
        <div>
          <span className="text-zinc-400">Transport Mode</span>
          <p className="font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5">{delivery.transportType} Freight</p>
        </div>
        <div>
          <span className="text-zinc-400">Initiated Date</span>
          <p className="font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5">{formatDeliveryDate(delivery.createdAt)}</p>
        </div>
        <div>
          <span className="text-zinc-400">Verification</span>
          <p className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
            <ShieldCheck className="size-3.5" /> Blockchain &amp; Live DB
          </p>
        </div>
      </div>

      {children && <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-3">{children}</div>}
    </article>
  )
}
