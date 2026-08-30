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
    <article className="w-full max-w-3xl rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6" aria-label={`${humanize(type)} details`}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-start gap-3">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${failed ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600'}`}>
            {failed ? <FileWarning aria-hidden="true" /> : <FileCheck2 aria-hidden="true" />}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Document</p>
            <h2 className="mt-1 text-lg font-semibold">{humanize(type)}</h2>
            <p className="mt-1 break-all text-sm text-muted-foreground">{fileName}</p>
          </div>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold capitalize text-muted-foreground">{processingStatus}</span>
      </header>

      <dl className="grid gap-4 py-5 text-sm sm:grid-cols-2">
        {reference && <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Reference</dt><dd className="mt-1 font-mono font-medium">{reference}</dd></div>}
        {confidence !== undefined && <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Extraction</dt><dd className="mt-1 font-medium">{Math.round(confidence * 100)}% confidence</dd></div>}
        {fileSizeBytes !== undefined && <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">File</dt><dd className="mt-1 font-medium">{fileSize(fileSizeBytes)}{mimeType ? ` · ${mimeType}` : ''}</dd></div>}
        <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Storage</dt><dd className="mt-1 flex items-center gap-1.5 font-medium"><Database className="size-4" aria-hidden="true" />{stored ? 'Stored' : 'No stored file'}</dd></div>
      </dl>

      {errorMessage && <p className="mb-5 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{errorMessage}</p>}

      <section className="border-t border-border pt-5" aria-label="Document parties">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Users className="size-4" aria-hidden="true" /> Document parties</h3>
        {parties.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No parties extracted.</p> : (
          <div className="mt-3 flex flex-wrap gap-2">
            {parties.map((party, index) => (
              <span key={`${party.role}-${party.name}-${index}`} className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs">
                <strong className="mr-1 text-muted-foreground">{humanize(party.role)}:</strong>{party.name}{party.reference ? ` · ${party.reference}` : ''}
              </span>
            ))}
          </div>
        )}
      </section>
    </article>
  )
}
