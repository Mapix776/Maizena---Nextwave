'use client'

import { Check, Circle, CircleDot, Ship, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { containerStatuses, ContainerStatus, statusIndex } from './types'

export function ContainerProgress({ currentStatus }: { currentStatus: ContainerStatus }) {
  const current = statusIndex(currentStatus)

  return (
    <section aria-label="Container progress" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Journey status</p>
          <h3 className="text-lg font-semibold tracking-tight">Container progress</h3>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium">{currentStatus}</span>
      </div>
      <div className="relative grid grid-cols-5 gap-1">
        <div className="absolute left-[10%] right-[10%] top-4 h-0.5 bg-border" aria-hidden="true" />
        <div className="absolute left-[10%] top-4 h-0.5 bg-primary transition-all" style={{ width: `${Math.max(0, current) * 20}%` }} aria-hidden="true" />
        {containerStatuses.map((status, index) => {
          const done = index < current
          const active = index === current
          return <div className="relative z-10 flex min-w-0 flex-col items-center gap-2 text-center" key={status}>
            <span className={cn('flex size-8 items-center justify-center rounded-full border-2 bg-background', done || active ? 'border-primary text-primary' : 'border-border text-muted-foreground')}>
              {done ? <Check className="size-4" aria-hidden="true" /> : active ? (index === 1 ? <Ship className="size-4" aria-hidden="true" /> : index === 2 ? <Truck className="size-4" aria-hidden="true" /> : <CircleDot className="size-4" aria-hidden="true" />) : <Circle className="size-3" aria-hidden="true" />}
            </span>
            <span className={cn('text-[11px] leading-tight', active ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{status}</span>
          </div>
        })}
      </div>
    </section>
  )
}
