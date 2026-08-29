import { defineCatalog, defineSchema } from '@json-render/core'
import { z } from 'zod'

import { containerStatuses } from '@/components/delivery/types'
import { documentStatuses } from '@/components/delivery/shipment-documents-timeline'

const deliveryProps = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  transportType: z.enum(['Sea', 'Land']),
  status: z.enum(containerStatuses),
  createdAt: z.string(),
  deliveryTime: z.string(),
})

export const jsonRenderSchema = defineSchema((s) => ({
  spec: s.object({
    root: s.string(),
    elements: s.record(s.object({
      type: s.string(),
      props: s.any(),
      children: s.array(s.string()),
    })),
  }),
  catalog: s.object({
    components: s.map({
      props: s.zod(),
    }),
  }),
}))

export const catalog = defineCatalog(jsonRenderSchema, {
  components: {
    AssistantMessage: {
      props: z.object({ text: z.string().min(1) }),
    },
    ContainerProgress: {
      props: z.object({ currentStatus: z.enum(containerStatuses) }),
    },
    DeliveryCard: {
      props: deliveryProps,
    },
    DeliveryIssueCard: {
      props: deliveryProps.extend({ issue: z.string() }),
    },
    BarChart: {
      props: z.object({
        title: z.string(),
        description: z.string().optional(),
        data: z.array(z.object({ label: z.string(), value: z.number() })),
        xAxisLabel: z.string().optional(),
        yAxisLabel: z.string().optional(),
        showValues: z.boolean().optional(),
        showGrid: z.boolean().optional(),
        orientation: z.enum(['vertical', 'horizontal']).optional(),
        height: z.number().min(180).max(700).optional(),
      }),
    },
    CatalogChart: {
      props: z.object({
        title: z.string(), description: z.string().optional(),
        chartType: z.enum(['line', 'pie', 'scatter', 'stackedArea', 'fluctuation', 'spider', 'groupedBar', 'pyramid', 'frequencyPolygon']),
        data: z.array(z.object({ label: z.string(), value: z.number().optional(), value2: z.number().optional(), value3: z.number().optional(), x: z.number().optional(), y: z.number().optional() })),
        height: z.number().min(180).max(700).optional(), showGrid: z.boolean().optional(),
      }),
    },
    ShipmentDocumentsTimeline: {
      props: z.object({
        title: z.string(),
        subtitle: z.string(),
        documents: z.array(z.object({
          id: z.string(),
          title: z.string(),
          description: z.string(),
          status: z.enum(documentStatuses),
          date: z.string().optional(),
          documentUrl: z.string().optional(),
        })),
      }),
    },
  },
})

export type JsonRenderSpec = typeof catalog._specType
