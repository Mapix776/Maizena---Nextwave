'use client'

import { AlertTriangle, CheckCircle2, GitCompareArrows } from 'lucide-react'

import type { ComparisonTableProps } from '../../../backend/src/contracts/ui'

export function ComparisonTable({
  title,
  operationReference,
  documentAName,
  documentBName,
  severity,
  fields,
  actions = [],
}: ComparisonTableProps) {
  const handleAction = (id: string, label: string, actionPayload?: string) => {
    window.dispatchEvent(
      new CustomEvent('nauta:decision-selected', {
        detail: { optionId: id, label, payload: actionPayload || label },
      }),
    )
  }

  return (
    <article className="w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xs" aria-label={title}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
            <GitCompareArrows className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Comparison</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">{title}</h2>
            {operationReference && <p className="mt-1 text-xs text-muted-foreground">{operationReference}</p>}
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${severity === 'critical' ? 'border-destructive/25 bg-destructive/10 text-destructive' : severity === 'warning' ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
          {severity}
        </span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Field</th>
              <th className="px-4 py-3 font-medium">{documentAName}</th>
              <th className="px-4 py-3 font-medium">{documentBName}</th>
              <th className="px-5 py-3 font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {fields.map((field) => {
              const matches = field.status === 'match'
              return (
                <tr key={field.field}>
                  <th className="px-5 py-3.5 font-medium">{field.label}</th>
                  <td className="px-4 py-3.5 text-muted-foreground">{field.valueA}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{field.valueB}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${matches ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                      {matches ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <AlertTriangle className="size-3.5" aria-hidden="true" />}
                      {field.diff || (matches ? 'Match' : 'Discrepancy')}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {actions.length > 0 && (
        <footer className="flex flex-wrap gap-2 border-t border-border bg-muted/40 p-4">
          {actions.map((action) => (
            <button key={action.id} type="button" onClick={() => handleAction(action.id, action.label, action.actionPayload)} className="rounded-sm border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {action.label}
            </button>
          ))}
        </footer>
      )}
    </article>
  )
}
