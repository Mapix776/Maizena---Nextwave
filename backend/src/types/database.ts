import type {
  CustomsLight,
  DocumentPartyRole,
  DocumentType,
} from '../contracts/domain.js';

export type OperationStatus =
  | 'BOOKED'
  | 'IN_TRANSIT'
  | 'AT_PORT'
  | 'CUSTOMS_CLEARANCE'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'EXCEPTION'
  | string;

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'PENDING' | 'COMPLETED' | 'FAILED';
export type Severity = 'normal' | 'warning' | 'critical' | 'NORMAL' | 'WARNING' | 'CRITICAL';
export type RunStatus = 'active' | 'completed' | 'failed' | 'waiting_decision' | 'RUNNING' | 'WAITING_INPUT' | 'COMPLETED' | 'FAILED';
export type DecisionStatus = 'pending' | 'resolved' | 'auto_executed' | 'expired' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'OVERRIDDEN' | 'EXPIRED';
export type ExecutionMode = 'auto' | 'requires_approval' | 'AUTO' | 'REQUIRE_APPROVAL';

export interface OperationRow {
  id: string;
  client_name: string;
  reference_code: string;
  status: OperationStatus;
  canonical_data: Record<string, unknown>;
  discrepancies: unknown[] | null;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  operation_id: string;
  type: DocumentType;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  document_reference: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  raw_md: string;
  extracted_json: Record<string, unknown> | null;
  confidence_score: number | null;
  processing_status: ProcessingStatus;
  error_message: string | null;
  created_at: string;
}

export interface DocumentPartyRow {
  id: string;
  document_id: string;
  party_role: DocumentPartyRole;
  party_name: string;
  party_reference: string | null;
  details_json: Record<string, unknown>;
  created_at: string;
}

export interface ContainerRow {
  id: string;
  operation_id: string;
  container_number: string;
  container_type: string | null;
  seal_number: string | null;
  status: string;
  origin_port: string;
  destination_port: string;
  eta: string | null;
  original_eta: string | null;
  actual_arrival: string | null;
  current_location: string | null;
  current_vessel: string | null;
  transit_history: unknown[] | null;
  weight_kg: number | null;
  declared_value_usd: number | null;
  customs_light?: CustomsLight | null;
  previo_completed_at?: string | null;
  pedimento_number?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunRow {
  id: string;
  operation_id: string;
  agent_name: string;
  flow_step: string;
  status: RunStatus;
  context_json: Record<string, unknown>;
  trigger_event: string | null;
  trigger_document_id: string | null;
  tokens_used: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: string;
  run_id: string | null;
  operation_id: string;
  severity: Severity;
  category: string;
  title: string;
  message: string;
  details_json: Record<string, unknown> | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface DecisionRow {
  id: string;
  run_id: string;
  operation_id: string;
  action_type: string;
  title: string;
  description: string | null;
  severity: Severity;
  execution_mode: ExecutionMode;
  default_action: unknown;
  options_json: unknown;
  question: string | null;
  answer: string | null;
  status: DecisionStatus;
  auto_execute_at: string | null;
  context_snapshot: Record<string, unknown> | null;
  user_response: unknown;
  created_at: string;
  resolved_at: string | null;
}
