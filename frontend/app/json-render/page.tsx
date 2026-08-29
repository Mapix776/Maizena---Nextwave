'use client'

import type { Spec } from '@json-render/core'
import { JsonRenderClient } from './render-client'

export const localSpec: Spec = {
  root: 'delivery-demo',
  elements: {
    'delivery-demo': { type: 'DeliveryCard', props: { id: 'container-001', from: 'Shanghai', to: 'Cartagena', transportType: 'Sea', status: 'In Transit', createdAt: '2026-08-29T10:30:00Z', deliveryTime: '18 days' }, children: [] },
    'progress-demo': { type: 'ContainerProgress', props: { currentStatus: 'In Transit' }, children: [] },
    'issue-demo': { type: 'DeliveryIssueCard', props: { id: 'container-002', from: 'Miami', to: 'Cartagena', transportType: 'Sea', status: 'Customs', issue: 'Customs clearance delayed', createdAt: '2026-08-29T10:30:00Z', deliveryTime: '21 days' }, children: [] },
  },
}

export default function JsonRenderPage() {
  const spec = { ...localSpec, root: 'page-root', elements: { 'page-root': { type: 'DeliveryCard', props: localSpec.elements['delivery-demo'].props, children: ['progress-demo', 'issue-demo'] }, ...localSpec.elements } }
  return <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-8"><div className="mx-auto flex max-w-3xl flex-col gap-8"><header><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">route.pilot / json-render</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Dynamic logistics UI</h1><p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">This page is rendered from a JSON spec through the official catalog, registry, and Renderer pipeline.</p></header><JsonRenderClient spec={spec} /></div></main>
}
