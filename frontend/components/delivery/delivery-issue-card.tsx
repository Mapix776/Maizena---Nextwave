import { AlertTriangle } from 'lucide-react'
import { DeliveryCard } from './delivery-card'
import { DeliveryIssue } from './types'

export function DeliveryIssueCard({ delivery }: { delivery: DeliveryIssue }) {
  return <div className="flex flex-col gap-3"><DeliveryCard delivery={delivery} /><aside className="flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100" role="alert"><AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><div><p className="text-xs font-bold uppercase tracking-[0.16em]">Issue</p><p className="font-medium">{delivery.issue}</p></div></aside></div>
}
