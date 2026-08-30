import { Database, FileCheck2, FileWarning, Users } from 'lucide-react'

import type { DocumentDetailsCardProps } from '../../../backend/src/contracts/logistics-ui'

function humanize(value: string) {
  const sentence = value.toLowerCase().replaceAll('_', ' ')
  return sentence[0].toUpperCase() + sentence.slice(1)
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export function DocumentDetailsCard({
  type,
  fileName,
  reference,
  processingStatus,
  confidence,
  fileSizeBytes,
  mimeType,
  stored,
  errorMessage,
  parties,
}: DocumentDetailsCardProps) {
  const failed = processingStatus === 'failed'
  return (
    <article
      className="w-full max-w-3xl rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs"
      aria-label={`${humanize(type)} details`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
              failed ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {failed ? <FileWarning className="size-4" aria-hidden="true" /> : <FileCheck2 className="size-4" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Document</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">{humanize(type)}</h2>
            <p className="mt-1 break-all text-sm text-muted-foreground">{fileName}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
            failed ? 'bg-destructive/10 text-destructive' : 'border border-border bg-muted text-muted-foreground'
          }`}
        >
          {processingStatus}
        </span>
      </header>

      <dl className="grid gap-4 py-5 text-sm sm:grid-cols-2">
        {reference && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reference</dt>
            <dd className="mt-1 font-mono text-sm font-medium">{reference}</dd>
          </div>
        )}
        {confidence !== undefined && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Extraction</dt>
            <dd className="mt-1 text-sm font-medium">{Math.round(confidence * 100)}% confidence</dd>
          </div>
        )}
        {fileSizeBytes !== undefined && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">File</dt>
            <dd className="mt-1 text-sm font-medium">
              {fileSize(fileSizeBytes)}
              {mimeType ? ` · ${mimeType}` : ''}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Storage</dt>
          <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium">
            <Database className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {stored ? 'Stored' : 'No stored file'}
          </dd>
        </div>
      </dl>

      {errorMessage && (
        <p className="mb-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{errorMessage}</p>
      )}

      <section className="border-t border-border pt-4" aria-label="Document parties">
        <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Users className="size-3.5 shrink-0" aria-hidden="true" /> Document parties
        </h3>
        {parties.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No parties extracted.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {parties.map((party, index) => (
              <span
                key={`${party.role}-${party.name}-${index}`}
                className="rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs"
              >
                <strong className="mr-1 font-medium text-muted-foreground">{humanize(party.role)}:</strong>
                {party.name}
                {party.reference ? ` · ${party.reference}` : ''}
              </span>
            ))}
          </div>
        )}
      </section>
    </article>
  )
}
