import { defineCatalog, defineSchema, type Spec, validateSpec } from '@json-render/core'
import { z } from 'zod'

import { containerStatuses } from '@/components/delivery/types'
import type { ReconciliationFindingsProps } from '@/components/delivery/reconciliation-findings'
import type {
  AgentRunTimelineProps,
  CustomsClearancePanelProps,
  DocumentDetailsCardProps,
  EtaRiskCardProps,
  HumanDecisionCardProps,
  OperationalAlertListProps,
  OperationsMetricsCardProps,
  OperationSummaryProps,
  ShipmentDocumentsTimelineProps,
  ShipmentMilestoneTimelineProps,
} from '../../../backend/src/contracts/logistics-ui'
import logisticsUiJsonSchema from '../../../backend/src/contracts/logistics-ui.schema.json'
import reconciliationFindingsJsonSchema from '../../../backend/src/contracts/reconciliation-findings.schema.json'
import type {
  ComparisonTableProps,
  KpiGridProps,
  StepProgressBarProps,
  tracerCatalog as backendTracerCatalog,
} from '../../../backend/src/contracts/ui'

const deliveryProps = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  transportType: z.enum(['Sea', 'Land']),
  status: z.enum(containerStatuses),
  createdAt: z.string(),
  deliveryTime: z.string(),
})

type LogisticsUiDefinitions = {
  $defs: Record<string, Record<string, unknown>>
}

const logisticsDefinitions = (logisticsUiJsonSchema as LogisticsUiDefinitions).$defs

function logisticsSchema<T>(name: string): z.ZodType<T> {
  return z.fromJSONSchema(logisticsDefinitions[name] as never) as z.ZodType<T>
}

const humanDecisionCardPropsSchema = logisticsSchema<HumanDecisionCardProps>('HumanDecisionCard')
const operationSummaryPropsSchema = logisticsSchema<OperationSummaryProps>('OperationSummaryCard')
const operationalAlertListPropsSchema = logisticsSchema<OperationalAlertListProps>('OperationalAlertList')
const shipmentDocumentsTimelinePropsSchema = logisticsSchema<ShipmentDocumentsTimelineProps>('ShipmentDocumentsTimeline')
const documentDetailsCardPropsSchema = logisticsSchema<DocumentDetailsCardProps>('DocumentDetailsCard')
const customsClearancePanelPropsSchema = logisticsSchema<CustomsClearancePanelProps>('CustomsClearancePanel')
const etaRiskCardPropsSchema = logisticsSchema<EtaRiskCardProps>('EtaRiskCard')
const agentRunTimelinePropsSchema = logisticsSchema<AgentRunTimelineProps>('AgentRunTimeline')
const shipmentMilestoneTimelinePropsSchema = logisticsSchema<ShipmentMilestoneTimelineProps>('ShipmentMilestoneTimeline')
const operationsMetricsCardPropsSchema = logisticsSchema<OperationsMetricsCardProps>('OperationsMetricsCard')

const reconciliationFindingsPropsSchema = z.fromJSONSchema(
  reconciliationFindingsJsonSchema as never,
) as z.ZodType<ReconciliationFindingsProps>

const comparisonTablePropsSchema: z.ZodType<ComparisonTableProps> = z.object({
  title: z.string().min(1),
  operationReference: z.string().optional(),
  documentAName: z.string().min(1),
  documentBName: z.string().min(1),
  severity: z.enum(['normal', 'warning', 'critical']).default('normal'),
  fields: z.array(z.object({
    field: z.string().min(1),
    label: z.string().min(1),
    valueA: z.union([z.string(), z.number()]),
    valueB: z.union([z.string(), z.number()]),
    status: z.enum(['match', 'discrepancy']),
    diff: z.string().optional(),
  }).strict()).min(1),
  actions: z.array(z.object({
    id: z.string(),
    label: z.string(),
    actionPayload: z.string().optional(),
  })).optional(),
}).strict()

const kpiGridPropsSchema: z.ZodType<KpiGridProps> = z.object({
  title: z.string().min(1),
  metrics: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    value: z.union([z.string(), z.number()]),
    unit: z.string().optional(),
    subtext: z.string().optional(),
    severity: z.enum(['normal', 'warning', 'critical']).default('normal'),
    trend: z.enum(['up', 'down', 'neutral']).optional(),
  }).strict()).min(1),
}).strict()

const stepProgressBarPropsSchema: z.ZodType<StepProgressBarProps> = z.object({
  title: z.string().min(1),
  currentStepIndex: z.number(),
  totalSteps: z.number(),
  steps: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    status: z.enum(['completed', 'current', 'pending']),
    date: z.string().optional(),
    location: z.string().optional(),
  }).strict()).min(2),
}).strict()

export const jsonRenderSchema = defineSchema((s) => ({
  spec: s.object({
    root: s.string(),
    elements: s.record(s.object({
      type: s.ref('catalog.components'),
      props: s.propsOf('catalog.components'),
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
    ComparisonTable: {
      props: comparisonTablePropsSchema,
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
    HumanDecisionCard: {
      props: humanDecisionCardPropsSchema,
    },
    OperationSummaryCard: {
      props: operationSummaryPropsSchema,
    },
    OperationalAlertList: {
      props: operationalAlertListPropsSchema,
    },
    DocumentDetailsCard: {
      props: documentDetailsCardPropsSchema,
    },
    CustomsClearancePanel: {
      props: customsClearancePanelPropsSchema,
    },
    EtaRiskCard: {
      props: etaRiskCardPropsSchema,
    },
    AgentRunTimeline: {
      props: agentRunTimelinePropsSchema,
    },
    ShipmentMilestoneTimeline: {
      props: shipmentMilestoneTimelinePropsSchema,
    },
    OperationsMetricsCard: {
      props: operationsMetricsCardPropsSchema,
    },
    ReconciliationFindings: {
      props: reconciliationFindingsPropsSchema,
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
    // Presentation-only analytics widget. Must stay semantically identical to
    // interactiveChartPropsSchema in backend/src/contracts/ui.ts.
    InteractiveChart: {
      props: z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        chartType: z.enum(['bar', 'line', 'pie']),
        data: z.array(z.object({ label: z.string(), value: z.number() })).min(1),
      }),
    },
    KpiGrid: {
      props: kpiGridPropsSchema,
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
      props: shipmentDocumentsTimelinePropsSchema,
    },
    StepProgressBar: {
      props: stepProgressBarPropsSchema,
    },
    InteractiveRouteMap: {
      props: z.object({
        title: z.string().min(1),
        operationReference: z.string().optional(),
        originPort: z.object({ name: z.string(), lat: z.number(), lng: z.number() }),
        destinationPort: z.object({ name: z.string(), lat: z.number(), lng: z.number() }),
        currentPosition: z.object({ name: z.string(), lat: z.number(), lng: z.number(), vessel: z.string().optional() }).optional(),
        status: z.string(),
        transportType: z.enum(['Sea', 'Land', 'Air']),
        waypoints: z.array(z.object({ name: z.string(), lat: z.number(), lng: z.number(), status: z.enum(['completed', 'current', 'pending']) })).optional(),
      }),
    },
  },
})

export type JsonRenderSpec = typeof catalog._specType

type BackendComponentName = (typeof backendTracerCatalog.componentNames)[number]
type FrontendComponentName = (typeof catalog.componentNames)[number]
type MissingFrontendComponent = Exclude<BackendComponentName, FrontendComponentName>

export const backendCatalogParity: MissingFrontendComponent extends never ? true : never = true

export function validateJsonRenderSpec(spec: unknown): JsonRenderSpec {
  const validation = catalog.validate(spec)
  if (!validation.success || !validation.data) {
    throw new Error('Invalid json-render tree', { cause: validation.error })
  }

  const structure = validateSpec(validation.data as Spec)
  if (!structure.valid) {
    throw new Error(`Structurally invalid json-render tree: ${structure.issues.map(({ message }) => message).join(' ')}`)
  }

  for (const element of Object.values(validation.data.elements)) {
    const componentName = element.type as keyof typeof catalog.data.components
    const component = catalog.data.components[componentName]
    const props = component.props.safeParse(element.props)
    if (!props.success) {
      throw new Error(`Invalid props for json-render component ${element.type}`, { cause: props.error })
    }
  }

  return validation.data
}
