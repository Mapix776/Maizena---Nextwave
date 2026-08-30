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
    OperationSummaryCard: {
      props: operationSummaryPropsSchema,
    },
    OperationalAlertList: {
      props: operationalAlertListPropsSchema,
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
  error?: string;
}
