import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { z } from 'zod'

export const tracerCatalog = defineCatalog(schema, {
  components: {
    Stack: {
      props: z.object({ gap: z.enum(['sm', 'md', 'lg']) }).strict(),
      slots: ['default'],
      description: 'A vertical layout for tracer content.',
    },
    Heading: {
      props: z.object({ text: z.string().min(1) }).strict(),
      slots: [],
      description: 'A prominent heading.',
    },
    Text: {
      props: z
        .object({
          text: z.string().min(1),
          tone: z.enum(['default', 'success']),
        })
        .strict(),
      slots: [],
      description: 'A line of run-generated text.',
    },
  },
  actions: {},
})

export type TracerSpec = typeof tracerCatalog._specType
