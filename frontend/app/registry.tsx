'use client'

import { defineRegistry } from '@json-render/react'

import { tracerCatalog } from './catalog'

export const { registry: tracerRegistry } = defineRegistry(tracerCatalog, {
  components: {
    Stack: ({ props, children }) => (
      <section className={`result-stack gap-${props.gap}`}>{children}</section>
    ),
    Heading: ({ props }) => <h2 className="result-heading">{props.text}</h2>,
    Text: ({ props }) => (
      <p className={`result-text result-text-${props.tone}`}>{props.text}</p>
    ),
  },
  actions: {},
})
