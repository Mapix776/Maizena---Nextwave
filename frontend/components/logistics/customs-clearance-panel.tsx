import { CircleCheck, CircleDashed, FileCheck2, ScanLine, ShieldAlert, ShieldCheck } from 'lucide-react'

import type { CustomsClearancePanelProps } from '../../../backend/src/contracts/logistics-ui'

const lightContent = {
  green: { title: 'Green light', detail: 'Cleared for release', style: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', Icon: ShieldCheck },
  red: { title: 'Red light', detail: 'Physical inspection required', style: 'bg-destructive/10 text-destructive', Icon: ShieldAlert },
  pending: { title: 'Light pending', detail: 'Awaiting customs result', style: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', Icon: ScanLine },
  unassigned: { title: 'Not assigned', detail: 'Customs review has not started', style: 'bg-muted text-muted-foreground', Icon: ScanLine },
}

export function CustomsClearancePanel(props: CustomsClearancePanelProps) {
  const light = lightContent[props.customsLight]
  return (
    <article className="w-full max-w-3xl rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6" aria-label={`Customs clearance for ${props.containerNumber}`}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Customs clearance</p>
          <h2 className="mt-1 font-mono text-lg font-semibold">{props.containerNumber}</h2>
          {props.currentLocation && <p className="mt-1 text-sm text-muted-foreground">{props.currentLocation}</p>}
        </div>
        <span className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${light.style}`}><light.Icon className="size-4" aria-hidden="true" />{light.title}</span>
      </header>

      <div className="my-5 rounded-xl bg-muted/40 p-4">
        <p className="font-medium">{light.detail}</p>
        <p className="mt-1 text-sm text-muted-foreground">Container status: {props.status.replaceAll('_', ' ')}</p>
      </div>

      <ol className="grid gap-3 sm:grid-cols-2">
        <li className="flex items-start gap-3 rounded-xl border border-border p-4">
          {props.previoStatus === 'completed' ? <CircleCheck className="size-5 shrink-0 text-emerald-600" aria-hidden="true" /> : <CircleDashed className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <div><h3 className="font-medium">Previo</h3><p className="text-sm capitalize text-muted-foreground">{props.previoStatus}</p>{props.previoCompletedAt && <time className="text-xs text-muted-foreground">{props.previoCompletedAt}</time>}</div>
        </li>
        <li className="flex items-start gap-3 rounded-xl border border-border p-4">
          <FileCheck2 className={`size-5 shrink-0 ${props.pedimentoStatus === 'completed' ? 'text-emerald-600' : 'text-muted-foreground'}`} aria-hidden="true" />
          <div><h3 className="font-medium">Pedimento</h3><p className="text-sm capitalize text-muted-foreground">{props.pedimentoStatus}</p>{props.pedimentoNumber && <p className="font-mono text-xs">{props.pedimentoNumber}</p>}</div>
        </li>
      </ol>

      {(props.alertIds.length > 0 || props.decisionIds.length > 0) && (
        <footer className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          {props.alertIds.length > 0 && <span>{props.alertIds.length} linked alert{props.alertIds.length === 1 ? '' : 's'}</span>}
          {props.decisionIds.length > 0 && <span>{props.decisionIds.length} pending decision{props.decisionIds.length === 1 ? '' : 's'}</span>}
        </footer>
      )}
    </article>
  )
}
