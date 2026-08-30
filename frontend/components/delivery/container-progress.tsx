'use client'

import { Check, Circle, CircleDot, CircleCheckBig, Ship, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { containerStatuses, ContainerStatus, statusIndex } from './types'

export function ContainerProgress({ currentStatus }: { currentStatus: ContainerStatus }) {
  const current = statusIndex(currentStatus)

  return (
    <section
      aria-label="Container progress"
      className="flex w-full max-w-2xl flex-col gap-5 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Journey status</p>
          <h3 className="mt-1 text-base font-semibold tracking-tight">Container progress</h3>
        </div>
        <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {currentStatus}
        </span>
      </div>
      <div className="relative grid grid-cols-5 gap-1">
        <div className="absolute left-[10%] right-[10%] top-4 h-px bg-border" aria-hidden="true" />
        <div className="absolute left-[10%] top-4 h-px bg-primary transition-all" style={{ width: `${Math.max(0, current) * 20}%` }} aria-hidden="true" />
        {containerStatuses.map((status, index) => {
          const done = index < current
          const active = index === current
          return <div className="relative z-10 flex min-w-0 flex-col items-center gap-2 text-center" key={status}>
            <span
              className={cn(
                'flex size-8 items-center justify-center rounded-full border bg-background transition-colors',
                done && 'border-primary/40 bg-primary/10 text-primary',
                active && 'border-primary bg-primary text-primary-foreground',
                !done && !active && 'border-border text-muted-foreground',
              )}
              aria-label={active && status === 'Delivered' ? 'Delivered — final status' : undefined}
            >
              {done ? <Check className="size-4" aria-hidden="true" /> : active ? (status === 'Delivered' ? <CircleCheckBig className="size-4" aria-hidden="true" /> : index === 1 ? <Ship className="size-4" aria-hidden="true" /> : index === 2 ? <Truck className="size-4" aria-hidden="true" /> : <CircleDot className="size-4" aria-hidden="true" />) : <Circle className="size-3" aria-hidden="true" />}
            </span>
            <span className={cn('text-xs leading-tight', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>{status}</span>
          </div>
        })}
      </div>
    </section>
  )
}
