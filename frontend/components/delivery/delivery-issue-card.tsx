import { AlertTriangle } from 'lucide-react'
import { DeliveryCard } from './delivery-card'
import { DeliveryIssue } from './types'

export function DeliveryIssueCard({ delivery }: { delivery: DeliveryIssue }) {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-3">
      <DeliveryCard delivery={delivery} />
      <aside
        className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300"
        role="alert"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider">Issue</p>
          <p className="mt-1 text-sm text-foreground">{delivery.issue}</p>
        </div>
      </aside>
    </div>
  )
}
