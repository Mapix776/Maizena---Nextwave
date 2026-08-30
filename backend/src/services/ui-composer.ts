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
} from '../contracts/logistics-ui.js';
import { reconciliationFindingsPropsSchema } from '../contracts/reconciliation.js';
import type { StepResult } from '../contracts/step-result.js';
import {
  comparisonTablePropsSchema,
  containerStatuses,
  interactiveChartPropsSchema,
  interactiveRouteMapPropsSchema,
  kpiGridPropsSchema,
  stepProgressBarPropsSchema,
} from '../contracts/ui.js';

type ContainerStatus = (typeof containerStatuses)[number];

interface UiElement {
  type: string;
  props: unknown;
  children: string[];
}

function parseFact<T>(
  schema: z.ZodType<T>,
  value: unknown,
  label: string,
): T | undefined {
  if (value === undefined) return undefined;

  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid ${label} fact`, { cause: parsed.error });
  }

  return parsed.data;
}

export function composeRunUi(result: StepResult): unknown {
  const assistantResponse = result.factPatch?.assistantResponse;
  const text =
    typeof assistantResponse === 'string' ? assistantResponse : result.summary;

  const humanDecision = parseFact(
    humanDecisionCardPropsSchema,
    result.factPatch?.humanDecision,
    'human decision',
  );
  const operationSummary = parseFact(
    operationSummaryPropsSchema,
    result.factPatch?.operationSummary,
    'operation summary',
  );
  const operationalAlerts = parseFact(
    operationalAlertListPropsSchema,
    result.factPatch?.operationalAlerts,
    'operational alerts',
  );
  const reconciliationFindings = parseFact(
    reconciliationFindingsPropsSchema,
    result.factPatch?.reconciliationFindings,
    'reconciliation findings',
  );
  const customsClearance = parseFact(
    z.array(customsClearancePanelPropsSchema),
    result.factPatch?.customsClearance,
    'customs clearance',
  );
  const etaRisks = parseFact(
    z.array(etaRiskCardPropsSchema),
    result.factPatch?.etaRisks,
    'ETA risks',
  );
  const documentsTimeline = parseFact(
    shipmentDocumentsTimelinePropsSchema,
    result.factPatch?.documentsTimeline,
    'documents timeline',
  );
  const documentDetails = parseFact(
    z.array(documentDetailsCardPropsSchema),
    result.factPatch?.documentDetails,
    'document details',
  );
  const agentRuns = parseFact(
    agentRunTimelinePropsSchema,
    result.factPatch?.agentRuns,
    'agent runs',
  );
  const shipmentMilestones = parseFact(
    z.array(shipmentMilestoneTimelinePropsSchema),
    result.factPatch?.shipmentMilestones,
    'shipment milestones',
  );
  const operationsMetrics = parseFact(
    operationsMetricsCardPropsSchema,
    result.factPatch?.operationsMetrics,
    'operations metrics',
  );
  const chart = parseFact(
    interactiveChartPropsSchema,
    result.factPatch?.chart,
    'interactive chart',
  );
  const routeMap = parseFact(
    interactiveRouteMapPropsSchema,
    result.factPatch?.routeMap,
    'interactive route map',
  );
  const comparisonTable = parseFact(
    comparisonTablePropsSchema,
    result.factPatch?.comparisonTable,
    'comparison table',
  );
  const kpiGrid = parseFact(
    kpiGridPropsSchema,
    result.factPatch?.kpiGrid,
    'kpi grid',
  );
  const stepProgressBar = parseFact(
    stepProgressBarPropsSchema,
    result.factPatch?.stepProgressBar,
    'step progress bar',
  );

  const elements: Record<string, UiElement> = {
    'assistant-message': {
      type: 'AssistantMessage',
      props: { text },
      children: [],
    },
  };
  const addElement = (
    id: string,
    type: string,
    props: unknown,
    children: string[] = [],
  ) => {
    elements[id] = { type, props, children };
    elements['assistant-message']?.children.push(id);
  };

  const deliveryId = result.factPatch?.deliveryId;
  const opRef = operationSummary?.referenceCode || (typeof deliveryId === 'string' ? deliveryId : 'main');

  if (humanDecision) {
    addElement('decision-card', 'HumanDecisionCard', humanDecision);
  }
  if (kpiGrid) {
    addElement('kpi-grid', 'KpiGrid', kpiGrid);
  }
  if (operationSummary) {
    addElement('operation-summary', 'OperationSummaryCard', operationSummary);
  }
  if (operationalAlerts) {
    addElement('operational-alerts', 'OperationalAlertList', operationalAlerts);
  }
  if (comparisonTable) {
    addElement('comparison-table', 'ComparisonTable', comparisonTable);
  }
  if (reconciliationFindings) {
    addElement(
      'reconciliation-findings',
      'ReconciliationFindings',
      reconciliationFindings,
    );
  }
  customsClearance?.forEach((props, index) => {
    const isCriticalOrExplicit =
      props.status === 'INSPECTION' ||
      props.status === 'CUSTOMS_HOLD' ||
      props.customsLight === 'red' ||
      !operationSummary;
    if (isCriticalOrExplicit) {
      addElement(
        `customs-panel-${props.containerNumber || index + 1}`,
        'CustomsClearancePanel',
        props,
      );
    }
  });
  etaRisks?.forEach((props, index) =>
    addElement(`eta-risk-${props.containerNumber || index + 1}`, 'EtaRiskCard', props),
  );
  if (stepProgressBar) {
    addElement('step-progress-bar', 'StepProgressBar', stepProgressBar);
  }
  if (documentsTimeline) {
    addElement(
      'shipment-documents',
      'ShipmentDocumentsTimeline',
      documentsTimeline,
    );
  } else {
    documentDetails?.forEach((props, index) =>
      addElement(`document-details-${props.documentId || index + 1}`, 'DocumentDetailsCard', props),
    );
  }
  if (agentRuns) {
    addElement('agent-runs', 'AgentRunTimeline', agentRuns);
  }
  shipmentMilestones?.forEach((props, index) =>
    addElement(
      `shipment-milestones-${props.containerNumber || index + 1}`,
      'ShipmentMilestoneTimeline',
      props,
    ),
  );
  if (operationsMetrics) {
    addElement('operations-metrics', 'OperationsMetricsCard', operationsMetrics);
  }
  if (chart) {
    addElement('interactive-chart', 'InteractiveChart', chart);
  }
  if (routeMap) {
    addElement('interactive-route-map', 'InteractiveRouteMap', routeMap);
  }

  // Render the legacy delivery cards only when there is no OperationSummaryCard
  // or when an explicit issue/alert is being highlighted.
  const from = result.factPatch?.from;
  const to = result.factPatch?.to;
  const transportType = result.factPatch?.transportType;
  const rawStatus = result.factPatch?.status;
  const deliveryTime = result.factPatch?.deliveryTime;
  const issue = result.factPatch?.issue;
  const hasDelivery =
    typeof deliveryId === 'string' &&
    typeof from === 'string' &&
    typeof to === 'string' &&
    (transportType === 'Sea' || transportType === 'Land') &&
    typeof rawStatus === 'string' &&
    containerStatuses.includes(rawStatus as ContainerStatus) &&
    typeof deliveryTime === 'string';

  if (hasDelivery && (!operationSummary || typeof issue === 'string')) {
    const status = rawStatus as ContainerStatus;
    const hasIssue = typeof issue === 'string';
    const cardProps = {
      id: deliveryId,
      from,
      to,
      transportType,
      status,
      createdAt: new Date().toISOString(),
      deliveryTime,
      ...(hasIssue ? { issue } : {}),
    };

    if (!hasIssue) {
      elements['container-progress'] = {
        type: 'ContainerProgress',
        props: { currentStatus: status },
        children: [],
      };
    }
    addElement(
      `delivery-card-${deliveryId}`,
      hasIssue ? 'DeliveryIssueCard' : 'DeliveryCard',
      cardProps,
      hasIssue ? [] : ['container-progress'],
    );
  }

  return {
    root: 'assistant-message',
    elements,
  };
}
