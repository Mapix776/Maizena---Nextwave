'use client'

import React from 'react'

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
  severity = 'normal',
  options,
  onSelectOption,
}: HumanDecisionCardProps) {
  const handleSelect = (option: DecisionOption) => {
    if (onSelectOption) {
      onSelectOption(option.id, option.actionPayload || option.id)
    } else {
      // Disparar evento personalizado global para que el chat / run-client lo capture
      const event = new CustomEvent('nauta:decision-selected', {
        detail: { optionId: option.id, payload: option.actionPayload || option.label },
      })
      window.dispatchEvent(event)
    }
  }

  const severityStyles = {
    normal: {
      border: 'border-blue-500/30',
      bg: 'bg-blue-950/20',
      badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      indicator: 'bg-blue-500',
    },
    warning: {
      border: 'border-amber-500/40',
      bg: 'bg-amber-950/20',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      indicator: 'bg-amber-500',
    },
    critical: {
      border: 'border-red-500/40',
      bg: 'bg-red-950/20',
      badge: 'bg-red-500/20 text-red-300 border-red-500/40',
      indicator: 'bg-red-500',
    },
  }[severity]

  return (
    <div
      className={`my-4 rounded-xl border ${severityStyles.border} ${severityStyles.bg} p-5 backdrop-blur-md transition-all shadow-lg`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-2.5 w-2.5 rounded-full ${severityStyles.indicator} animate-pulse`} />
        <h3 className="font-semibold text-white tracking-wide text-base">{title}</h3>
      </div>

      <p className="text-sm text-zinc-300 mb-4 leading-relaxed">{question}</p>

      <div className="space-y-2.5">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option)}
            type="button"
            className="w-full text-left rounded-lg border border-zinc-700/60 bg-zinc-900/80 hover:bg-zinc-800/90 hover:border-zinc-500/80 p-3.5 transition-all duration-200 group flex items-start justify-between gap-3 cursor-pointer"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-white group-hover:text-blue-400 transition-colors text-sm">
                  {option.label}
                </span>
                {option.badge && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${severityStyles.badge}`}
                  >
                    {option.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 leading-normal">{option.description}</p>
            </div>
            <div className="text-zinc-500 group-hover:text-white transition-colors pt-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
