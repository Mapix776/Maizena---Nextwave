export interface RunContext {
  runId: string;
  operationId: string;
  flowStep: string;
  history: Array<{ step: string; timestamp: string; summary: string }>;
  data: Record<string, unknown>;
}

export type UIFocus =
  | 'route_update'
  | 'decision_required'
  | 'document_alert'
  | 'status_change'
  | 'reconciliation_result';

export interface UIIntent {
  focus: UIFocus;
  severity: 'normal' | 'warning' | 'critical';
  data: Record<string, unknown>;
}

export interface AgentAction {
  type: string;
  requiresApproval: boolean;
  payload: unknown;
}

export interface AgentOutput {
  runId: string;
  agentName: 'ari' | 'recon';
  events: Array<{ severity: 'normal' | 'warning' | 'critical'; message: string }>;
  uiIntent: UIIntent;
  action?: AgentAction;
  contextUpdate: Partial<RunContext>;
}

export interface AgentInput {
  runId: string;
  agentName: 'ari' | 'recon';
  trigger: 'document.ingested' | 'scheduled' | 'human.decision';
  context: RunContext;
  payload: unknown;
}
