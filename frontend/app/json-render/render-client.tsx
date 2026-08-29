'use client'

import { JSONUIProvider, Renderer } from '@json-render/react'
import type { Spec } from '@json-render/core'
import { registry } from '@/lib/json-render/registry'

export function JsonRenderClient({ spec }: { spec: Spec }) {
  return <JSONUIProvider registry={registry}><Renderer spec={spec} registry={registry} /></JSONUIProvider>
}
