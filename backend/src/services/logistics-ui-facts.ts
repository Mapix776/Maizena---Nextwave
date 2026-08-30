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
  type AgentRunTimelineProps,
  type CustomsClearancePanelProps,
  type DocumentDetailsCardProps,
  type EtaRiskCardProps,
  type HumanDecisionCardProps,
  type OperationalAlertListProps,
  type OperationsMetricsCardProps,
  type OperationSummaryProps,
  type ShipmentDocumentsTimelineProps,
  type ShipmentDocumentStatus,
  type ShipmentMilestoneTimelineProps,
  type UiSeverity,
} from '../contracts/logistics-ui.js';
import type {
  OperationFullDetails,
  OperationsMetricsSummary,
} from './supabase-reader.js';
import type { ContainerRow, DecisionRow, EventRow } from '../types/database.js';

export interface OperationCatalogFacts {
  operationSummary: OperationSummaryProps;
  operationalAlerts?: OperationalAlertListProps;
  humanDecision?: HumanDecisionCardProps;
  documentsTimeline?: ShipmentDocumentsTimelineProps;
  documentDetails: DocumentDetailsCardProps[];
  customsClearance: CustomsClearancePanelProps[];
  etaRisks: EtaRiskCardProps[];
  agentRuns?: AgentRunTimelineProps;
  shipmentMilestones: ShipmentMilestoneTimelineProps[];
}

function present(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function normalizeSeverity(value: string): UiSeverity {
  const normalized = value.toLowerCase();
  return normalized === 'critical'
    ? 'critical'
    : normalized === 'warning'
      ? 'warning'
      : 'normal';
}

export function buildOperationalAlertsCatalogFacts(
  events: EventRow[],
  operationReference = 'All operations',
): OperationalAlertListProps {
  return operationalAlertListPropsSchema.parse({
    title: 'Operational alerts',
    operationReference,
    alerts: events.map((event) => ({
      id: event.id,
      severity: normalizeSeverity(event.severity),
      category: event.category,
      title: event.title,
      message: event.message,
      acknowledged: event.acknowledged,
      createdAt: event.created_at,
    })),
  });
}

const decisionOptionsSchema = z.array(
  z
    .object({
      id: z.string().min(1),
      label: z.string().min(1),
      description: z.string().min(1).optional(),
      badge: z.string().min(1).optional(),
      actionPayload: z.string().min(1).optional(),
    })
    .strict(),
);
const transitHistoryItemSchema = z.object({
  at: z.string().datetime({ offset: true }),
  status: z.string().min(1),
  location: z.string().min(1).optional(),
});

const coreDocuments = [
  ['PURCHASE_ORDER', 'purchase-order', 'Purchase order'],
  ['BOOKING_CONFIRMATION', 'booking-confirmation', 'Booking confirmation'],
  ['BILL_OF_LADING', 'bill-of-lading', 'Bill of lading'],
  ['COMMERCIAL_INVOICE', 'commercial-invoice', 'Commercial invoice'],
  ['PACKING_LIST', 'packing-list', 'Packing list'],
] as const;

function normalizeDocumentStatus(value: string): ShipmentDocumentStatus {
  const normalized = value.toLowerCase();
  if (normalized === 'completed') return 'completed';
  if (normalized === 'processing') return 'in_progress';
  if (normalized === 'pending') return 'pending';
  return 'missing';
}

export function buildHumanDecisionCatalogFact(
  decisions: DecisionRow[],
): HumanDecisionCardProps | undefined {
  const pendingDecision = decisions[0];
  const decisionOptions = pendingDecision
    ? decisionOptionsSchema.safeParse(pendingDecision.options_json)
    : undefined;

  if (!pendingDecision || !decisionOptions?.success || decisionOptions.data.length === 0) {
    return undefined;
  }

  return humanDecisionCardPropsSchema.parse({
    decisionId: pendingDecision.id,
    operationId: pendingDecision.operation_id,
    title: pendingDecision.title,
    ...(present(pendingDecision.description)
      ? { description: pendingDecision.description }
      : {}),
    question: pendingDecision.question ?? pendingDecision.title,
    severity: normalizeSeverity(pendingDecision.severity),
    executionMode:
      pendingDecision.execution_mode.toLowerCase() === 'auto'
        ? 'auto'
        : 'requires_approval',
    ...(present(pendingDecision.auto_execute_at)
      ? { autoExecuteAt: pendingDecision.auto_execute_at }
      : {}),
    createdAt: pendingDecision.created_at,
    options: decisionOptions.data,
  });
}

export function buildCustomsClearanceCatalogFacts(
  containers: ContainerRow[],
  events: EventRow[] = [],
  decisions: DecisionRow[] = [],
): CustomsClearancePanelProps[] {
  return containers
    .filter(
      (container) =>
        (container.customs_light !== null &&
          container.customs_light !== undefined) ||
        container.status.includes('CUSTOMS') ||
        present(container.previo_completed_at) ||
        present(container.pedimento_number),
    )
    .map((container) =>
      customsClearancePanelPropsSchema.parse({
        containerNumber: container.container_number,
        status: container.status,
        customsLight: container.customs_light ?? 'unassigned',
        ...(present(container.current_location)
          ? { currentLocation: container.current_location }
          : {}),
        ...(present(container.actual_arrival)
          ? { actualArrival: container.actual_arrival }
          : {}),
        previoStatus: present(container.previo_completed_at)
          ? 'completed'
          : 'pending',
        ...(present(container.previo_completed_at)
          ? { previoCompletedAt: container.previo_completed_at }
          : {}),
        pedimentoStatus: present(container.pedimento_number)
          ? 'completed'
          : 'pending',
        ...(present(container.pedimento_number)
          ? { pedimentoNumber: container.pedimento_number }
          : {}),
        alertIds: events
          .filter((event) => event.category.toLowerCase().includes('customs'))
          .map((event) => event.id),
        decisionIds: decisions
          .filter((decision) => decision.action_type.toLowerCase().includes('customs'))
          .map((decision) => decision.id),
      }),
    );
}

export function buildOperationCatalogFacts(
  details: OperationFullDetails,
): OperationCatalogFacts {
  const operationSummary = operationSummaryPropsSchema.parse({
    operationId: details.operation.id,
    referenceCode: details.operation.reference_code,
    clientName: details.operation.client_name,
    status: details.operation.status,
    tags: details.operation.tags ?? [],
    ...(present(details.operation.notes) ? { notes: details.operation.notes } : {}),
    containers: details.containers.map((container) => ({
      id: container.id,
      containerNumber: container.container_number,
      status: container.status,
      originPort: container.origin_port,
      destinationPort: container.destination_port,
      ...(present(container.eta) ? { eta: container.eta } : {}),
      ...(present(container.actual_arrival)
        ? { actualArrival: container.actual_arrival }
        : {}),
      ...(present(container.current_location)
        ? { currentLocation: container.current_location }
        : {}),
      ...(present(container.current_vessel)
        ? { currentVessel: container.current_vessel }
        : {}),
      ...(container.customs_light
        ? { customsLight: container.customs_light }
        : {}),
    })),
  });

  const operationalAlerts = details.events.length
    ? buildOperationalAlertsCatalogFacts(
        details.events,
        details.operation.reference_code,
      )
    : undefined;

  const humanDecision = buildHumanDecisionCatalogFact(details.decisions);

  const documentsTimeline = shipmentDocumentsTimelinePropsSchema.parse({
    title: 'Shipment documents',
    subtitle: `${details.operation.reference_code} · core import readiness`,
    documents: coreDocuments.map(([type, id, title]) => {
      const document = details.documents.find((candidate) => candidate.type === type);
      if (!document) {
        return {
          id,
          title,
          description: 'Required for the core import workflow.',
          status: 'missing' as const,
        };
      }

      return {
        id,
        title,
        description: [document.document_reference, document.file_name]
          .filter(present)
          .join(' · '),
        status: normalizeDocumentStatus(document.processing_status),
        date: document.created_at,
      };
    }),
  });

  const documentDetails = details.documents.map((document) =>
    documentDetailsCardPropsSchema.parse({
      documentId: document.id,
      type: document.type,
      fileName: document.file_name,
      ...(present(document.document_reference)
        ? { reference: document.document_reference }
        : {}),
      processingStatus: document.processing_status.toLowerCase(),
      ...(document.confidence_score === null
        ? {}
        : { confidence: document.confidence_score }),
      ...(document.file_size === null ? {} : { fileSizeBytes: document.file_size }),
      ...(present(document.mime_type) ? { mimeType: document.mime_type } : {}),
      stored: present(document.storage_bucket) && present(document.storage_path),
      ...(present(document.error_message)
        ? { errorMessage: document.error_message }
        : {}),
      createdAt: document.created_at,
      parties: details.parties
        .filter((party) => party.document_id === document.id)
        .map((party) => ({
          role: party.party_role,
          name: party.party_name,
          ...(present(party.party_reference)
            ? { reference: party.party_reference }
            : {}),
        })),
    }),
  );

  const customsClearance = buildCustomsClearanceCatalogFacts(
    details.containers,
    details.events,
    details.decisions,
  );

  const etaRisks = details.containers.flatMap((container) => {
    if (!present(container.original_eta) || !present(container.eta)) return [];
    const slipMilliseconds =
      Date.parse(container.eta) - Date.parse(container.original_eta);
    if (!Number.isFinite(slipMilliseconds) || slipMilliseconds <= 0) return [];
    const slipDays = Math.ceil(slipMilliseconds / 86_400_000);

    return [
      etaRiskCardPropsSchema.parse({
        containerNumber: container.container_number,
        originalEta: container.original_eta,
        currentEta: container.eta,
        slipDays,
        severity: slipDays >= 7 ? 'critical' : 'warning',
        ...(present(container.current_location)
          ? { currentLocation: container.current_location }
          : {}),
        ...(present(container.current_vessel)
          ? { currentVessel: container.current_vessel }
          : {}),
      }),
    ];
  });

  const agentRuns = details.runs.length
    ? agentRunTimelinePropsSchema.parse({
        title: 'Agent activity',
        operationReference: details.operation.reference_code,
        runs: details.runs.map((run) => ({
          id: run.id,
          agentName: run.agent_name,
          flowStep: run.flow_step,
          status: run.status.toLowerCase(),
          ...(present(run.trigger_event) ? { triggerEvent: run.trigger_event } : {}),
          ...(run.tokens_used === null ? {} : { tokensUsed: run.tokens_used }),
          ...(present(run.error_message) ? { errorMessage: run.error_message } : {}),
          createdAt: run.created_at,
          updatedAt: run.updated_at,
        })),
      })
    : undefined;

  const shipmentMilestones = details.containers.flatMap((container) => {
    const milestones = (container.transit_history ?? []).flatMap((entry) => {
      const parsed = transitHistoryItemSchema.safeParse(entry);
      return parsed.success ? [parsed.data] : [];
    });
    if (milestones.length === 0) return [];

    return [
      shipmentMilestoneTimelinePropsSchema.parse({
        containerNumber: container.container_number,
        originPort: container.origin_port || 'Por confirmar',
        destinationPort: container.destination_port || 'Por confirmar',
        milestones,
      }),
    ];
  });

  return {
    operationSummary,
    ...(operationalAlerts ? { operationalAlerts } : {}),
    ...(humanDecision ? { humanDecision } : {}),
    documentsTimeline,
    documentDetails,
    customsClearance,
    etaRisks,
    ...(agentRuns ? { agentRuns } : {}),
    shipmentMilestones,
  };
}

export function buildOperationsMetricsCatalogFacts(
  summary: OperationsMetricsSummary,
): OperationsMetricsCardProps {
  return operationsMetricsCardPropsSchema.parse({
    totalOperations: summary.totalOperations,
    totalContainers: summary.totalContainers,
    containersInTransit: summary.containersInTransit,
    containersInCustoms: summary.containersInCustoms,
    delayedContainersCount: summary.delayedContainersCount,
    criticalAlertsCount: summary.criticalAlertsCount,
    pendingDecisionsCount: summary.pendingDecisionsCount,
    byStatus: Object.entries(summary.byStatus)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([status, count]) => ({ status, count })),
  });
}
