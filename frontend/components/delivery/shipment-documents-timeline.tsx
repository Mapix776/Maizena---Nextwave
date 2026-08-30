'use client'

import type { ComponentType } from 'react'
import {
  ArrowUpRight,
  BadgeCheck,
  ClipboardList,
  FileCheck2,
  FileText,
  PackageCheck,
  ReceiptText,
  Ship,
} from 'lucide-react'

export const documentStatuses = ['completed', 'in_progress', 'pending', 'missing'] as const
export type DocumentStatus = (typeof documentStatuses)[number]

export interface ShipmentDocument {
  id: string
  title: string
  description: string
  status: DocumentStatus
  date?: string
  documentUrl?: string
}

export interface ShipmentDocumentsTimelineProps {
  title: string
  subtitle: string
  documents: ShipmentDocument[]
}

const documentIcons: Record<string, ComponentType<{ className?: string }>> = {
  'purchase-order': ClipboardList,
  'booking-confirmation': Ship,
  'bill-of-lading': FileCheck2,
  'commercial-invoice': ReceiptText,
  invoice: ReceiptText,
  'packing-list': PackageCheck,
  'arrival-notice': FileText,
}

const statusLabels: Record<DocumentStatus, string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  pending: 'Pending',
  missing: 'Missing',
}

function statusStyles(status: DocumentStatus) {
  if (status === 'completed') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (status === 'in_progress') return 'border-primary/25 bg-primary/10 text-primary'
  if (status === 'missing') return 'border-destructive/25 bg-destructive/10 text-destructive'
  return 'border-border bg-muted text-muted-foreground'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value))
}

export function ShipmentDocumentsTimeline({ title, subtitle, documents }: ShipmentDocumentsTimelineProps) {
  const completed = documents.filter((document) => document.status === 'completed').length
  const progress = documents.length ? Math.round((completed / documents.length) * 100) : 0

  return (
    <article className="flex w-full max-w-2xl flex-col gap-6 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
      <header className="flex items-start justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BadgeCheck aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">{completed} of {documents.length} completed</p>
          <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-muted" aria-label={`${progress}% complete`} role="progressbar" aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress}>
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>

      <ol className="relative flex flex-col gap-0">
        {documents.map((document, index) => {
          const Icon = documentIcons[document.id] ?? FileText
          const isLast = index === documents.length - 1
          const isCompleted = document.status === 'completed'
          return (
            <li key={document.id} className="relative flex gap-4 pb-6 last:pb-0">
              {!isLast && <span className={`absolute left-4 top-8 h-[calc(100%-0.5rem)] w-px ${isCompleted ? 'bg-primary/60' : 'bg-border'}`} aria-hidden="true" />}
              <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border ${isCompleted ? 'border-primary bg-primary text-primary-foreground' : document.status === 'in_progress' ? 'border-primary bg-background text-primary ring-4 ring-primary/10' : 'border-border bg-muted text-muted-foreground'}`}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{document.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{document.description}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles(document.status)}`}>{statusLabels[document.status]}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                  {document.date && <time dateTime={document.date}>{formatDate(document.date)}</time>}
                  {document.documentUrl && <a className="inline-flex items-center gap-1 font-medium text-primary hover:underline" href={document.documentUrl} target="_blank" rel="noreferrer">View document <ArrowUpRight className="size-3.5" aria-hidden="true" /></a>}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </article>
  )
}
