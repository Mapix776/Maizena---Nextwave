import { Check, MapPin } from 'lucide-react'

import type { StepProgressBarProps } from '../../../backend/src/contracts/ui'

export function StepProgressBar({ title, currentStepIndex, totalSteps, steps }: StepProgressBarProps) {
  const completedPercentage = totalSteps > 1
    ? Math.min(100, Math.max(0, (currentStepIndex / (totalSteps - 1)) * 100))
    : 0

  return (
    <article className="w-full max-w-3xl rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs" aria-label={title}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Shipment progress</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight">{title}</h2>
        </div>
        <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          Step {Math.min(currentStepIndex + 1, totalSteps)} of {totalSteps}
        </span>
      </header>

      <div className="relative">
        <div className="absolute left-4 right-4 top-4 hidden h-0.5 bg-border sm:block" aria-hidden="true">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${completedPercentage}%` }} />
        </div>
        <ol className="relative grid gap-4 sm:grid-flow-col sm:auto-cols-fr sm:gap-2">
          {steps.map((step) => (
            <li key={step.id} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 sm:flex sm:flex-col sm:items-center sm:px-1 sm:text-center">
              <span className={`relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold ${step.status === 'completed' ? 'border-primary bg-primary text-primary-foreground' : step.status === 'current' ? 'border-primary bg-card text-primary ring-4 ring-primary/10' : 'border-border bg-card text-muted-foreground'}`}>
                {step.status === 'completed' ? <Check className="size-4" aria-hidden="true" /> : steps.indexOf(step) + 1}
              </span>
              <div className="min-w-0 sm:mt-2">
                <p className={`text-xs font-medium ${step.status === 'current' ? 'text-primary' : step.status === 'pending' ? 'text-muted-foreground' : 'text-foreground'}`}>{step.label}</p>
                {step.location && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground sm:justify-center"><MapPin className="size-3" aria-hidden="true" />{step.location}</p>}
                {step.date && <time className="mt-1 block text-xs text-muted-foreground">{step.date}</time>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </article>
  )
}
