import { z } from 'zod';

import logisticsUiJsonSchema from './logistics-ui.schema.json' with {
  type: 'json',
};

export interface OperationSummaryContainer {
  id: string;
  containerNumber: string;
  status: string;
  originPort: string;
  destinationPort: string;
  eta?: string;
  actualArrival?: string;
  currentLocation?: string;
  currentVessel?: string;
  customsLight?: 'green' | 'red' | 'pending';
}

export interface OperationSummaryProps {
  operationId: string;
  referenceCode: string;
  clientName: string;
  status: string;
  tags: string[];
  notes?: string;
  containers: OperationSummaryContainer[];
}

export type UiSeverity = 'normal' | 'warning' | 'critical';

export interface OperationalAlertListProps {
  title: string;
  operationReference: string;
  alerts: Array<{
    id: string;
    severity: UiSeverity;
    category: string;
    title: string;
    message: string;
    acknowledged: boolean;
    createdAt: string;
  }>;
}

export interface HumanDecisionCardProps {
  decisionId?: string;
  operationId?: string;
  title: string;
  description?: string;
  question: string;
  severity: UiSeverity;
  executionMode?: 'auto' | 'requires_approval';
  autoExecuteAt?: string;
  createdAt?: string;
  options: Array<{
    id: string;
    label: string;
    description?: string;
    badge?: string;
    actionPayload?: string;
  }>;
}

export type ShipmentDocumentStatus =
  | 'completed'
  | 'in_progress'
  | 'pending'
  | 'missing';

export interface ShipmentDocumentsTimelineProps {
  title: string;
  subtitle: string;
  documents: Array<{
    id: string;
    title: string;
    description: string;
    status: ShipmentDocumentStatus;
    date?: string;
    documentUrl?: string;
  }>;
}

export interface DocumentDetailsCardProps {
  documentId: string;
  type: string;
  fileName: string;
  reference?: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  confidence?: number;
  fileSizeBytes?: number;
  mimeType?: string;
  stored: boolean;
  errorMessage?: string;
  createdAt: string;
  parties: Array<{
    role: string;
    name: string;
    reference?: string;
  }>;
}

export interface CustomsClearancePanelProps {
  containerNumber: string;
  status: string;
  customsLight: 'green' | 'red' | 'pending' | 'unassigned';
  currentLocation?: string;
  actualArrival?: string;
  previoStatus: 'completed' | 'pending';
  previoCompletedAt?: string;
  pedimentoStatus: 'completed' | 'pending';
  pedimentoNumber?: string;
  alertIds: string[];
  decisionIds: string[];
}

export interface EtaRiskCardProps {
  containerNumber: string;
  originalEta: string;
  currentEta: string;
  slipDays: number;
  severity: 'warning' | 'critical';
  currentLocation?: string;
  currentVessel?: string;
}

export interface AgentRunTimelineProps {
  title: string;
  operationReference: string;
  runs: Array<{
    id: string;
    agentName: string;
    flowStep: string;
    status:
      | 'active'
      | 'running'
      | 'waiting_input'
      | 'waiting_decision'
      | 'completed'
      | 'failed';
    triggerEvent?: string;
    tokensUsed?: number;
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface ShipmentMilestoneTimelineProps {
  containerNumber: string;
  originPort: string;
  destinationPort: string;
  milestones: Array<{
    at: string;
    status: string;
    location?: string;
  }>;
}

export interface OperationsMetricsCardProps {
  totalOperations: number;
  totalContainers: number;
  containersInTransit: number;
  containersInCustoms: number;
  delayedContainersCount: number;
  criticalAlertsCount: number;
  pendingDecisionsCount: number;
  byStatus: Array<{ status: string; count: number }>;
}

type LogisticsUiSchemaDefinitions = {
  $defs: {
    OperationSummaryCard: Record<string, unknown>;
    OperationalAlertList: Record<string, unknown>;
    HumanDecisionCard: Record<string, unknown>;
    ShipmentDocumentsTimeline: Record<string, unknown>;
    DocumentDetailsCard: Record<string, unknown>;
    CustomsClearancePanel: Record<string, unknown>;
    EtaRiskCard: Record<string, unknown>;
    AgentRunTimeline: Record<string, unknown>;
    ShipmentMilestoneTimeline: Record<string, unknown>;
    OperationsMetricsCard: Record<string, unknown>;
  };
};

const definitions = (logisticsUiJsonSchema as LogisticsUiSchemaDefinitions).$defs;

export const operationSummaryPropsSchema = z.fromJSONSchema(
  definitions.OperationSummaryCard as never,
) as z.ZodType<OperationSummaryProps>;

export const operationalAlertListPropsSchema = z.fromJSONSchema(
  definitions.OperationalAlertList as never,
) as z.ZodType<OperationalAlertListProps>;

export const humanDecisionCardPropsSchema = z.fromJSONSchema(
  definitions.HumanDecisionCard as never,
) as z.ZodType<HumanDecisionCardProps>;

export const shipmentDocumentsTimelinePropsSchema = z.fromJSONSchema(
  definitions.ShipmentDocumentsTimeline as never,
) as z.ZodType<ShipmentDocumentsTimelineProps>;

export const documentDetailsCardPropsSchema = z.fromJSONSchema(
  definitions.DocumentDetailsCard as never,
) as z.ZodType<DocumentDetailsCardProps>;

export const customsClearancePanelPropsSchema = z.fromJSONSchema(
  definitions.CustomsClearancePanel as never,
) as z.ZodType<CustomsClearancePanelProps>;

export const etaRiskCardPropsSchema = z.fromJSONSchema(
  definitions.EtaRiskCard as never,
) as z.ZodType<EtaRiskCardProps>;

export const agentRunTimelinePropsSchema = z.fromJSONSchema(
  definitions.AgentRunTimeline as never,
) as z.ZodType<AgentRunTimelineProps>;

export const shipmentMilestoneTimelinePropsSchema = z.fromJSONSchema(
  definitions.ShipmentMilestoneTimeline as never,
) as z.ZodType<ShipmentMilestoneTimelineProps>;

export const operationsMetricsCardPropsSchema = z.fromJSONSchema(
  definitions.OperationsMetricsCard as never,
) as z.ZodType<OperationsMetricsCardProps>;
