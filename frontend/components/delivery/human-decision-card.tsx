'use client'

import { useState } from 'react'
import { CheckCircle2, ChevronRight, Sparkles, UserCheck } from 'lucide-react'
import type { HumanDecisionCardProps as CatalogDecisionProps } from '../../../backend/src/contracts/logistics-ui'

export type DecisionOption = CatalogDecisionProps['options'][number]

export interface HumanDecisionCardProps extends CatalogDecisionProps {
  onSelectOption?: (optionId: string, payload?: string) => void
}

export function HumanDecisionCard({
  decisionId,
  operationId,
  title,
  description,
  question,
  severity = 'normal',
  executionMode,
  autoExecuteAt,
  options = [],
  onSelectOption,
}: HumanDecisionCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSelect = (option: DecisionOption) => {
    if (submitted) return

    setSelectedId(option.id)
    setSubmitted(true)

    const payload = option.actionPayload || option.label
    onSelectOption?.(option.id, payload)

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nauta:decision-selected', {
          detail: {
            decisionId,
            operationId,
            optionId: option.id,
            payload,
            label: option.label,
          },
          bubbles: true,
          composed: true,
        }),
      )
    }
  }

  const isCritical = severity === 'critical'
  const isWarning = severity === 'warning'

  const severityStyles = isCritical
    ? 'border-destructive/25 bg-destructive/10 text-destructive'
    : isWarning
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
      : 'border-primary/25 bg-primary/10 text-primary'

  return (
    <article
      className="pointer-events-auto my-4 w-full max-w-3xl rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs"
      aria-label={title}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
            <UserCheck className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Human-in-the-Loop Action Required
            </p>
            <h3 className="mt-1 text-base font-semibold leading-tight tracking-tight">
              {title}
            </h3>
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${severityStyles}`}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {severity.toUpperCase()}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {executionMode && (
          <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {executionMode === 'requires_approval' ? 'Requires approval' : 'Automatic'}
          </span>
        )}
        {autoExecuteAt && (
          <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            Automatic action scheduled for {autoExecuteAt}
          </span>
        )}
      </div>

      {description && (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      )}
      <p className="mb-4 mt-3 rounded-sm border border-border bg-muted/40 p-3 text-sm leading-6">
        {question}
      </p>

      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const isSelected = selectedId === option.id

          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option)}
              type="button"
              disabled={submitted}
              className={`group flex w-full select-none items-start justify-between gap-3 rounded-sm border p-3.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : submitted
                    ? 'cursor-not-allowed border-border bg-muted/40 opacity-60'
                    : 'cursor-pointer border-border bg-background hover:border-primary/40 hover:bg-primary/5'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {option.label}
                  </span>
                  {option.badge && (
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {option.badge}
                    </span>
                  )}
                </div>
                {option.description && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {option.description}
                  </p>
                )}
              </div>

              <span className="shrink-0 pt-0.5">
                {isSelected ? (
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  </span>
                ) : (
                  <span className="flex size-6 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary">
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {submitted && (
        <div className="mt-3 flex items-center gap-2 rounded-sm border border-primary/20 bg-primary/5 p-2.5 text-xs font-medium text-primary">
          <Sparkles className="size-4 shrink-0" aria-hidden="true" />
          <span>Decision submitted. Ari is executing your approved action...</span>
        </div>
      )}
    </article>
  )
}
