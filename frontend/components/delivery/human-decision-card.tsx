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

  return (
    <article
      className="relative my-4 w-full max-w-3xl overflow-hidden rounded-2xl border-2 border-purple-300 bg-white p-5 shadow-xl transition-all pointer-events-auto dark:border-purple-800/80 dark:bg-zinc-950"
      aria-label={title}
    >
      <div className="absolute -right-12 -top-12 size-36 rounded-full bg-purple-500/10 blur-2xl pointer-events-none dark:bg-purple-600/20" />

      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-purple-600 text-white shadow-xs">
            <UserCheck className="size-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Human-in-the-Loop Action Required
            </span>
            <h3 className="text-base font-bold leading-tight text-zinc-900 dark:text-white">
              {title}
            </h3>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
            isCritical
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300'
              : isWarning
                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                : 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
          }`}
        >
          <span className="size-1.5 animate-ping rounded-full bg-current" />
          {severity.toUpperCase()}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {executionMode && (
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {executionMode === 'requires_approval' ? 'Requires approval' : 'Automatic'}
          </span>
        )}
        {autoExecuteAt && (
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Automatic action scheduled for {autoExecuteAt}
          </span>
        )}
      </div>

      {description && (
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      )}
      <p className="mb-4 mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm font-medium leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
        {question}
      </p>

      <div className="space-y-2.5">
        {options.map((option) => {
          const isSelected = selectedId === option.id

          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option)}
              type="button"
              disabled={submitted}
              className={`group flex w-full select-none items-start justify-between gap-3 rounded-xl border-2 p-3.5 text-left transition-all duration-200 ${
                isSelected
                  ? 'border-purple-600 bg-purple-50/90 shadow-md ring-2 ring-purple-400 dark:bg-purple-950/70'
                  : submitted
                    ? 'cursor-not-allowed border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/40'
                    : 'cursor-pointer border-zinc-200 bg-white hover:border-purple-500 hover:bg-purple-50/40 hover:shadow-md active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:bg-purple-950/30'
              }`}
            >
              <div className="flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`text-sm font-bold transition-colors ${
                      isSelected
                        ? 'text-purple-900 dark:text-purple-200'
                        : 'text-zinc-900 group-hover:text-purple-600 dark:text-white dark:group-hover:text-purple-400'
                    }`}
                  >
                    {option.label}
                  </span>
                  {option.badge && (
                    <span className="rounded-md border border-purple-200 bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:border-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                      {option.badge}
                    </span>
                  )}
                </div>
                {option.description && (
                  <p className="text-xs leading-normal text-zinc-600 dark:text-zinc-400">
                    {option.description}
                  </p>
                )}
              </div>

              <div className="shrink-0 pt-0.5">
                {isSelected ? (
                  <div className="flex size-6 items-center justify-center rounded-full bg-purple-600 text-white shadow-xs">
                    <CheckCircle2 className="size-4" />
                  </div>
                ) : (
                  <div className="flex size-6 items-center justify-center rounded-full border border-zinc-300 text-zinc-400 transition-colors group-hover:border-purple-500 group-hover:bg-purple-100 group-hover:text-purple-600 dark:border-zinc-700 dark:group-hover:bg-purple-950">
                    <ChevronRight className="size-3.5" />
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {submitted && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-100/70 p-2.5 text-xs font-semibold text-purple-700 animate-fade-in dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
          <Sparkles className="size-4 animate-spin text-purple-600" />
          <span>Decision submitted. Ari is executing your approved action...</span>
        </div>
      )}
    </article>
  )
}
