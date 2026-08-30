import { AlertTriangle, CheckCircle2, FileCheck2 } from 'lucide-react'

export type ReconciliationField = 'containerNumber' | 'weightKg' | 'amountUsd'

export interface ReconciliationDiscrepancy {
  field: ReconciliationField
  severity: 'warning' | 'critical'
  values: {
    billOfLading: string | number
    commercialInvoice: string | number
    packingList: string | number
  }
}

export interface ReconciliationFindingsProps {
  status: 'matched' | 'discrepancy'
  severity: 'normal' | 'warning' | 'critical'
  discrepancies: ReconciliationDiscrepancy[]
  evidenceIds: string[]
}

const fieldLabels: Record<ReconciliationField, string> = {
  containerNumber: 'Container number',
  weightKg: 'Weight',
  amountUsd: 'Declared amount',
}

function formatValue(field: ReconciliationField, value: string | number) {
  if (typeof value !== 'number') return value
  if (field === 'weightKg') return `${new Intl.NumberFormat('en-US').format(value)} kg`
  if (field === 'amountUsd') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value)
  }
  return String(value)
}

export function ReconciliationFindings({
  status,
  severity,
  discrepancies,
  evidenceIds,
}: ReconciliationFindingsProps) {
  const matched = status === 'matched'
  const severityLabel = matched
    ? 'Matched'
    : severity === 'critical'
      ? 'Critical discrepancy'
      : 'Review required'

  return (
    <article className="w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xs" aria-label="Document reconciliation findings">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-sm ${matched ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : severity === 'critical' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
            {matched ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <AlertTriangle className="size-4" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recon</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">Document reconciliation</h2>
            <p className="mt-1 text-sm text-muted-foreground">Bill of Lading · Commercial Invoice · Packing List</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${matched ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : severity === 'critical' ? 'border-destructive/25 bg-destructive/10 text-destructive' : 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
          {severityLabel}
        </span>
      </header>

      {matched ? (
        <div className="flex items-start gap-3 p-5">
          <FileCheck2 className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">All compared fields match.</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Container number, weight, and declared amount are consistent across the three documents.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Field</th>
                <th className="px-4 py-3 font-medium">Bill of Lading</th>
                <th className="px-4 py-3 font-medium">Commercial Invoice</th>
                <th className="px-5 py-3 font-medium">Packing List</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {discrepancies.map((discrepancy) => (
                <tr key={discrepancy.field}>
                  <th className="px-5 py-3.5 font-medium">
                    <span className="flex items-center gap-2">
                      <span className={`size-1.5 rounded-full ${discrepancy.severity === 'critical' ? 'bg-destructive' : 'bg-amber-500'}`} aria-hidden="true" />
                      {fieldLabels[discrepancy.field]}
                    </span>
                  </th>
                  <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">{formatValue(discrepancy.field, discrepancy.values.billOfLading)}</td>
                  <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">{formatValue(discrepancy.field, discrepancy.values.commercialInvoice)}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{formatValue(discrepancy.field, discrepancy.values.packingList)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer className="border-t border-border bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
        {evidenceIds.length} evidence {evidenceIds.length === 1 ? 'source' : 'sources'} recorded
      </footer>
    </article>
  )
}
