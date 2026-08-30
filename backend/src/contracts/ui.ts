import {
  defineCatalog,
  defineSchema,
  type Spec,
  validateSpec,
} from '@json-render/core';
import { z } from 'zod';

import {
  agentRunTimelinePropsSchema,
  customsClearancePanelPropsSchema,
  documentDetailsCardPropsSchema,
  etaRiskCardPropsSchema,
  humanDecisionCardPropsSchema,
  operationalAlertListPropsSchema,
  operationsMetricsCardPropsSchema,
  operationSummaryPropsSchema,
  shipmentDocumentsTimelinePropsSchema,
  shipmentMilestoneTimelinePropsSchema,
} from './logistics-ui.js';
import { reconciliationFindingsPropsSchema } from './reconciliation.js';
import type { WorkTrace } from './work-trace.js';

export const containerStatuses = [
  'Booking Confirmed',
  'In Transit',
  'Arrived at Port',
  'Customs',
  'Delivered',
] as const;

const deliveryProps = z
  .object({
    id: z.string(),
    from: z.string(),
    to: z.string(),
    transportType: z.enum(['Sea', 'Land']),
    status: z.enum(containerStatuses),
    createdAt: z.string(),
    deliveryTime: z.string(),
  })
  .strict();

export const humanDecisionCardProps = humanDecisionCardPropsSchema;

export const interactiveChartPropsSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    chartType: z.enum(['bar', 'line', 'pie']),
    data: z.array(z.object({ label: z.string(), value: z.number() }).strict()).min(1),
  })
  .strict();

export const portLocationSchema = z
  .object({
    name: z.string().min(1),
    lat: z.number(),
    lng: z.number(),
  })
  .strict();

export const currentPositionSchema = z
  .object({
    name: z.string().min(1),
    lat: z.number(),
    lng: z.number(),
    vessel: z.string().optional(),
  })
  .strict();

export const routeWaypointSchema = z
  .object({
    name: z.string().min(1),
    lat: z.number(),
    lng: z.number(),
    status: z.enum(['completed', 'current', 'pending']),
  })
  .strict();

export const interactiveRouteMapPropsSchema = z
  .object({
    title: z.string().min(1),
    operationReference: z.string().optional(),
    originPort: portLocationSchema,
    destinationPort: portLocationSchema,
    currentPosition: currentPositionSchema.optional(),
    status: z.string().min(1),
    transportType: z.enum(['Sea', 'Land', 'Air']).default('Sea'),
    waypoints: z.array(routeWaypointSchema).optional(),
  })
  .strict();

export const comparisonFieldSchema = z
  .object({
    field: z.string().min(1),
    label: z.string().min(1),
    valueA: z.union([z.string(), z.number()]),
    valueB: z.union([z.string(), z.number()]),
    status: z.enum(['match', 'discrepancy']),
    diff: z.string().optional(),
  })
  .strict();

export const comparisonTablePropsSchema = z
  .object({
    title: z.string().min(1),
    operationReference: z.string().optional(),
    documentAName: z.string().min(1),
    documentBName: z.string().min(1),
    severity: z.enum(['normal', 'warning', 'critical']).default('normal'),
    fields: z.array(comparisonFieldSchema).min(1),
    actions: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          actionPayload: z.string().optional(),
        }),
      )
      .optional(),
  })
  .strict();

export type ComparisonTableProps = z.infer<typeof comparisonTablePropsSchema>;

export const kpiMetricSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    value: z.union([z.string(), z.number()]),
    unit: z.string().optional(),
    subtext: z.string().optional(),
    severity: z.enum(['normal', 'warning', 'critical']).default('normal'),
    trend: z.enum(['up', 'down', 'neutral']).optional(),
  })
  .strict();

export const kpiGridPropsSchema = z
  .object({
    title: z.string().min(1),
    metrics: z.array(kpiMetricSchema).min(1),
  })
  .strict();

export type KpiGridProps = z.infer<typeof kpiGridPropsSchema>;

export const progressStepNodeSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    status: z.enum(['completed', 'current', 'pending']),
    date: z.string().optional(),
    location: z.string().optional(),
  })
  .strict();

export const stepProgressBarPropsSchema = z
  .object({
    title: z.string().min(1),
    currentStepIndex: z.number(),
    totalSteps: z.number(),
    steps: z.array(progressStepNodeSchema).min(2),
  })
  .strict();

export type StepProgressBarProps = z.infer<typeof stepProgressBarPropsSchema>;

// Server-safe mirror of frontend/lib/json-render/catalog.ts. It keeps React
// out of the backend while making component names and props catalog-bound.
const reactSpecSchema = defineSchema((schema) => ({
  spec: schema.object({
    root: schema.string(),
    elements: schema.record(
      schema.object({
        type: schema.ref('catalog.components'),
        props: schema.propsOf('catalog.components'),
        children: schema.array(schema.string()),
      }),
    ),
  }),
  catalog: schema.object({
    components: schema.map({
      props: schema.zod(),
    }),
  }),
}));

export const tracerCatalog = defineCatalog(reactSpecSchema, {
  components: {
    AssistantMessage: {
      props: z.object({ text: z.string().min(1) }).strict(),
    },
    ComparisonTable: {
      props: comparisonTablePropsSchema,
    },
    ContainerProgress: {
      props: z
        .object({ currentStatus: z.enum(containerStatuses) })
        .strict(),
    },
    DeliveryCard: {
      props: deliveryProps,
    },
    DeliveryIssueCard: {
      props: deliveryProps.extend({ issue: z.string() }),
    },
    HumanDecisionCard: {
      props: humanDecisionCardProps,
    },
    InteractiveChart: {
      props: interactiveChartPropsSchema,
    },
    InteractiveRouteMap: {
      props: interactiveRouteMapPropsSchema,
    },
    KpiGrid: {
      props: kpiGridPropsSchema,
    },
    OperationSummaryCard: {
      props: operationSummaryPropsSchema,
    },
    OperationalAlertList: {
      props: operationalAlertListPropsSchema,
    },
    StepProgressBar: {
      props: stepProgressBarPropsSchema,
    },
    ShipmentDocumentsTimeline: {
      props: shipmentDocumentsTimelinePropsSchema,
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
  },
});

export type TracerSpec = typeof tracerCatalog._specType;

export function validateTracerSpec(spec: unknown): TracerSpec {
  const validation = tracerCatalog.validate(spec);

  if (!validation.success || !validation.data) {
    throw new Error('Invalid json-render tree', { cause: validation.error });
  }

  const structure = validateSpec(validation.data as Spec);

  if (!structure.valid) {
    throw new Error(
      `Structurally invalid json-render tree: ${structure.issues
        .map(({ message }) => message)
        .join(' ')}`,
    );
  }

  for (const element of Object.values(validation.data.elements)) {
    const componentName = element.type as keyof typeof tracerCatalog.data.components;
    const component = tracerCatalog.data.components[componentName];
    const props = component.props.safeParse(element.props);

    if (!props.success) {
      throw new Error(`Invalid props for json-render component ${element.type}`, {
        cause: props.error,
      });
    }
  }

  return validation.data;
}

export interface JsonRenderPatch {
  op: 'add' | 'update' | 'remove';
  elementId: string;
  targetMessageId?: string;
  element?: unknown;
}

export interface UIReplacePayload {
  uiVersion: number;
  reason: string;
  spec: TracerSpec;
  workTrace: WorkTrace;
  targetMessageId?: string;
}

export interface UIEnvelope<TPayload = unknown> {
  runId: string;
  sequence: number;
  type: 'run:status' | 'ui:replace' | 'run:complete';
  timestamp: string;
  payload: TPayload;
}

export interface RunSnapshot {
  runId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  sequence: number;
  facts: Record<string, unknown>;
  ui: TracerSpec | null;
  workTrace: WorkTrace | null;
  error?: string;
  targetMessageId?: string;
}
