'use client'

import React, { useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronRight, Sparkles, UserCheck } from 'lucide-react'

export interface DecisionOption {
  id: string
  label: string
  description: string
  badge?: string
  actionPayload?: string
}

export interface HumanDecisionCardProps {
  id?: string
  title: string
  question: string
  severity?: 'normal' | 'warning' | 'critical'
  options: DecisionOption[]
  onSelectOption?: (optionId: string, payload?: string) => void
}

export function HumanDecisionCard({
  title,
  question,
  severity = 'critical',
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

    if (onSelectOption) {
      onSelectOption(option.id, payload)
    }

    // Disparar evento personalizado global para que el chat / tracer lo procese de inmediato
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('nauta:decision-selected', {
        detail: {
          optionId: option.id,
          payload,
          label: option.label,
        },
        bubbles: true,
        composed: true,
      })
      window.dispatchEvent(event)
    }
  }

  const isCritical = severity === 'critical'
  const isWarning = severity === 'warning'

  return (
    <div className="my-4 rounded-2xl border-2 border-purple-300 dark:border-purple-800/80 bg-white dark:bg-zinc-950 p-5 shadow-xl transition-all relative overflow-hidden pointer-events-auto">
      {/* Decorative gradient blur background */}
      <div className="absolute -top-12 -right-12 size-36 rounded-full bg-purple-500/10 dark:bg-purple-600/20 blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
            <UserCheck className="size-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Human-in-the-Loop Action Required
            </span>
            <h3 className="font-bold text-zinc-900 dark:text-white text-base leading-tight">
              {title}
            </h3>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
            isCritical
              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800'
              : isWarning
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
          }`}
        >
          <span className="size-1.5 rounded-full bg-current animate-ping" />
          {severity.toUpperCase()}
        </span>
      </div>

      {/* Question Prompt */}
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4 mt-2 leading-relaxed bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
        {question}
      </p>

      {/* Interactive Options List */}
      <div className="space-y-2.5">
        {options.map((option, index) => {
          const isSelected = selectedId === option.id

          return (
            <button
              key={option.id || index}
              onClick={() => handleSelect(option)}
              type="button"
              disabled={submitted}
              className={`w-full text-left rounded-xl border-2 p-3.5 transition-all duration-200 flex items-start justify-between gap-3 cursor-pointer select-none group ${
                isSelected
                  ? 'border-purple-600 bg-purple-50/90 dark:bg-purple-950/70 shadow-md ring-2 ring-purple-400'
                  : submitted
                    ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 opacity-60 cursor-not-allowed'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 hover:border-purple-500 hover:bg-purple-50/40 dark:hover:bg-purple-950/30 hover:shadow-md active:scale-[0.99]'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className={`font-bold text-sm transition-colors ${
                      isSelected
                        ? 'text-purple-900 dark:text-purple-200'
                        : 'text-zinc-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400'
                    }`}
                  >
                    {option.label}
                  </span>
                  {option.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
                      {option.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
                  {option.description}
                </p>
              </div>

              <div className="shrink-0 pt-0.5">
                {isSelected ? (
                  <div className="size-6 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs">
                    <CheckCircle2 className="size-4" />
                  </div>
                ) : (
                  <div className="size-6 rounded-full border border-zinc-300 dark:border-zinc-700 group-hover:border-purple-500 group-hover:bg-purple-100 dark:group-hover:bg-purple-950 text-zinc-400 group-hover:text-purple-600 flex items-center justify-center transition-colors">
                    <ChevronRight className="size-3.5" />
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Confirmation feedback */}
      {submitted && (
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-100/70 dark:bg-purple-950/60 p-2.5 rounded-lg border border-purple-200 dark:border-purple-800 animate-fade-in">
          <Sparkles className="size-4 text-purple-600 animate-spin" />
          <span>Decision submitted. Ari is executing your approved action...</span>
        </div>
      )}
    </div>
  )
}
