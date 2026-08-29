import type { ReactNode } from 'react'
import { Ship, Truck } from 'lucide-react'
import { Delivery, formatDeliveryDate, statusTone } from './types'

export function DeliveryCard({ delivery, children }: { delivery: Delivery; children?: ReactNode }) {
  const TransportIcon = delivery.transportType === 'Sea' ? Ship : Truck
  return <article className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Delivery</p><h2 className="text-xl font-semibold tracking-tight">{delivery.id}</h2></div><span className={`rounded-full border border-border px-3 py-1 text-xs font-medium ${statusTone(delivery.status)}`}>{delivery.status}</span></div>
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">From</p><p className="text-lg font-semibold">{delivery.from}</p></div><div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"><TransportIcon aria-hidden="true" /></div><div className="text-right"><p className="text-xs uppercase tracking-wider text-muted-foreground">To</p><p className="text-lg font-semibold">{delivery.to}</p></div></div>
    <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm sm:grid-cols-4"><div><dt className="text-muted-foreground">Type</dt><dd className="font-medium">{delivery.transportType}</dd></div><div><dt className="text-muted-foreground">Status</dt><dd className="font-medium">{delivery.status}</dd></div><div><dt className="text-muted-foreground">Created at</dt><dd className="font-medium">{formatDeliveryDate(delivery.createdAt)}</dd></div><div><dt className="text-muted-foreground">Delivery time</dt><dd className="font-medium">{delivery.deliveryTime}</dd></div></dl>{children && <div className="border-t border-border pt-4">{children}</div>}
  </article>
}
