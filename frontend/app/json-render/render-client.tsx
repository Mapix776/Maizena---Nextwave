'use client'

import { JSONUIProvider, Renderer } from '@json-render/react'
import type { Spec } from '@json-render/core'
import { registry } from '@/lib/json-render/registry'
import { validateJsonRenderSpec } from '@/lib/json-render/catalog'

export function JsonRenderClient({ spec }: { spec: Spec }) {
  const validatedSpec = validateJsonRenderSpec(spec)
  return <JSONUIProvider registry={registry}><Renderer spec={validatedSpec} registry={registry} /></JSONUIProvider>
}
