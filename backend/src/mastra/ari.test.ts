import assert from 'node:assert/strict';
import test from 'node:test';

import { Agent } from '@mastra/core/agent';

import {
  ARI_SYSTEM_PROMPT,
  createAriAgent,
  executeAriStep,
} from './ari.js';
import { DeterministicRenderModel } from './models.js';

test('Ari uses the helpful-assistant prompt and returns one render-demo tool result', async () => {
  let toolExecutions = 0;
  const agent = createAriAgent({
    model: new DeterministicRenderModel(),
    onRenderToolExecution: () => {
      toolExecutions += 1;
    },
  });

  assert.ok(agent instanceof Agent);
  const instructions = await agent.getInstructions();
  if (typeof instructions !== 'object' || !('content' in instructions)) {
    assert.fail('Expected Ari instructions to include provider options.');
  }
  assert.ok(String(instructions.content).startsWith(ARI_SYSTEM_PROMPT));
  assert.match(JSON.stringify(instructions), /renderDemoTool/);

  const result = await executeAriStep(
    [{ role: 'user', content: 'Please help me.' }],
    agent,
  );

  assert.equal(toolExecutions, 1);
  assert.equal(result.status, 'completed');
  assert.equal(result.summary, 'I can help with that.');
  assert.equal(result.factPatch?.assistantResponse, 'I can help with that.');
  assert.equal(result.factPatch?.transportType, 'Sea');
  assert.ok(Array.isArray(result.factPatch?.executionSteps));
  assert.ok(
    result.evidence.some(
      ({ id, source }) =>
        id === 'json-render-ui' &&
        source === 'json-render:dynamic-components',
    ),
  );
  assert.ok(result.evidence.some(({ id }) => id === 'step-1'));
});

test('Ari preserves the typed Recon tool result as evidence-backed UI facts', async () => {
  const reconciliation = {
    status: 'discrepancy',
    severity: 'critical',
    discrepancies: [
      {
        field: 'containerNumber',
        severity: 'critical',
        values: {
          billOfLading: 'MSCU1234567',
          commercialInvoice: 'MSCU1234567',
          packingList: 'TGHU7654321',
        },
      },
    ],
  };
  const fakeAgent = {
    async generate(_messages: unknown, options: any) {
      await options.delegation.onDelegationComplete({
        primitiveId: 'recon',
        result: {
          text: 'Recon found a critical container-number discrepancy.',
          subAgentToolResults: [
            {
              toolName: 'reconcileShipmentDocumentsTool',
              toolCallId: 'recon-call-1',
              result: reconciliation,
            },
          ],
        },
      });

      return {
        text: 'Recon found a critical container-number discrepancy.',
        toolResults: [],
      };
    },
  };

  const result = await executeAriStep(
    [{ role: 'user', content: 'Reconcile these shipment documents.' }],
    fakeAgent as never,
  );

  assert.deepEqual(result.factPatch?.reconciliationFindings, {
    ...reconciliation,
    evidenceIds: ['reconciliation-tool-result'],
  });
  assert.ok(
    result.evidence.some(
      (item) =>
        item.id === 'reconciliation-tool-result' &&
        item.source === 'mastra:recon/reconcileShipmentDocumentsTool',
    ),
  );
});

test('Ari turns a typed operation-details tool result into catalog facts', async () => {
  const details = {
    operation: {
      id: 'operation-1',
      client_name: 'Muebles del Sur',
      reference_code: 'MDS-DEMO-RED-081',
      status: 'CUSTOMS_CLEARANCE',
      canonical_data: {},
      discrepancies: [],
      tags: ['demo'],
      notes: null,
      created_at: '2026-08-29T20:00:00Z',
      updated_at: '2026-08-29T20:00:00Z',
    },
    containers: [],
    documents: [],
    events: [],
    decisions: [],
    runs: [],
    parties: [],
    relationships: [],
  };
  const renderResult = {
    status: 'completed',
    summary: 'I found the operation.',
    factPatch: { assistantResponse: 'I found the operation.' },
    evidence: [{ id: 'json-render-ui', source: 'json-render:dynamic-components' }],
  };
  const fakeAgent = {
    async generate() {
      return {
        text: 'I found the operation.',
        toolResults: [
          {
            payload: {
              toolName: 'getOperationDetailsTool',
              result: { found: true, details },
              isError: false,
            },
          },
          {
            payload: {
              toolName: 'renderDemoTool',
              result: renderResult,
              isError: false,
            },
          },
        ],
      };
    },
  };

  const result = await executeAriStep(
    [{ role: 'user', content: 'Show operation MDS-DEMO-RED-081.' }],
    fakeAgent as never,
  );

  assert.deepEqual(result.factPatch?.operationSummary, {
    operationId: 'operation-1',
    referenceCode: 'MDS-DEMO-RED-081',
    clientName: 'Muebles del Sur',
    status: 'CUSTOMS_CLEARANCE',
    tags: ['demo'],
    containers: [],
  });
  assert.ok(
    result.evidence.some(
      ({ id, source }) =>
        id === 'supabase-operation-details' &&
        source === 'supabase:get-operation-details',
    ),
  );
});

test('Ari preserves a typed operational-alert query as a catalog fact', async () => {
  const alert = {
    id: 'event-1',
    run_id: null,
    operation_id: 'operation-1',
    severity: 'WARNING',
    category: 'eta_delay',
    title: 'ETA moved by three days',
    message: 'The carrier published a revised ETA.',
    details_json: null,
    acknowledged: false,
    acknowledged_by: null,
    acknowledged_at: null,
    created_at: '2026-08-29T20:00:00Z',
  };
  const fakeAgent = {
    async generate() {
      return {
        text: 'One alert needs attention.',
        toolResults: [
          {
            payload: {
              toolName: 'getOperationalAlertsTool',
              result: { count: 1, alerts: [alert] },
              isError: false,
            },
          },
        ],
      };
    },
  };

  const result = await executeAriStep(
    [{ role: 'user', content: 'Show active alerts.' }],
    fakeAgent as never,
  );

  assert.deepEqual(result.factPatch?.operationalAlerts, {
    title: 'Operational alerts',
    operationReference: 'All operations',
    alerts: [
      {
        id: 'event-1',
        severity: 'warning',
        category: 'eta_delay',
        title: 'ETA moved by three days',
        message: 'The carrier published a revised ETA.',
        acknowledged: false,
        createdAt: '2026-08-29T20:00:00Z',
      },
    ],
  });
});

test('Ari preserves a typed global metrics query as a constrained catalog fact', async () => {
  const summary = {
    totalOperations: 11,
    byStatus: { IN_TRANSIT: 4, DELIVERED: 1 },
    totalContainers: 11,
    containersInTransit: 4,
    containersInCustoms: 3,
    delayedContainersCount: 2,
    criticalAlertsCount: 4,
    pendingDecisionsCount: 4,
  };
  const fakeAgent = {
    async generate() {
      return {
        text: 'Here is the operations summary.',
        toolResults: [
          {
            payload: {
              toolName: 'getOperationsSummaryTool',
              result: { summary },
              isError: false,
            },
          },
        ],
      };
    },
  };

  const result = await executeAriStep(
    [{ role: 'user', content: 'Show the global operations summary.' }],
    fakeAgent as never,
  );

  assert.deepEqual(result.factPatch?.operationsMetrics, {
    ...summary,
    byStatus: [
      { status: 'DELIVERED', count: 1 },
      { status: 'IN_TRANSIT', count: 4 },
    ],
  });
});

test('Ari preserves a typed pending-decision query as a real decision card fact', async () => {
  const decision = {
    id: 'decision-1',
    run_id: 'run-1',
    operation_id: 'operation-1',
    action_type: 'customs_red_light_escalation',
    title: 'Choose customs response',
    description: 'Physical inspection may delay release.',
    severity: 'CRITICAL',
    execution_mode: 'REQUIRE_APPROVAL',
    default_action: { action: 'notify_client' },
    options_json: [{ id: 'notify', label: 'Notify client' }],
    question: 'How should Ari proceed?',
    answer: null,
    status: 'PENDING',
    auto_execute_at: null,
    context_snapshot: null,
    user_response: null,
    created_at: '2026-08-29T20:00:00Z',
    resolved_at: null,
  };
  const fakeAgent = {
    async generate() {
      return {
        text: 'One decision is waiting.',
        toolResults: [
          {
            payload: {
              toolName: 'getPendingDecisionsTool',
              result: { count: 1, decisions: [decision] },
              isError: false,
            },
          },
        ],
      };
    },
  };

  const result = await executeAriStep(
    [{ role: 'user', content: 'Show pending decisions.' }],
    fakeAgent as never,
  );

  const humanDecision = result.factPatch?.humanDecision as
    | { decisionId?: string; executionMode?: string }
    | undefined;
  assert.equal(humanDecision?.decisionId, 'decision-1');
  assert.equal(humanDecision?.executionMode, 'requires_approval');
});

test('Ari preserves typed customs query results as clearance facts', async () => {
  const container = {
    id: 'container-1',
    operation_id: 'operation-1',
    container_number: 'MSDU7000810',
    container_type: '40HC',
    seal_number: null,
    status: 'CUSTOMS_HOLD',
    origin_port: 'Ho Chi Minh City, Vietnam',
    destination_port: 'Manzanillo, Mexico',
    eta: '2026-08-26T12:00:00Z',
    original_eta: null,
    actual_arrival: '2026-08-27T08:00:00Z',
    current_location: 'Aduana Manzanillo',
    current_vessel: 'MSC AURORA',
    transit_history: [],
    weight_kg: 18120,
    declared_value_usd: 68500,
    customs_light: 'red',
    previo_completed_at: null,
    pedimento_number: null,
    created_at: '2026-08-29T20:00:00Z',
    updated_at: '2026-08-29T20:00:00Z',
  };
  const fakeAgent = {
    async generate() {
      return {
        text: 'One container has a red customs light.',
        toolResults: [
          {
            payload: {
              toolName: 'getCustomsStatusTool',
              result: { count: 1, containers: [container] },
              isError: false,
            },
          },
        ],
      };
    },
  };

  const result = await executeAriStep(
    [{ role: 'user', content: 'Show red customs containers.' }],
    fakeAgent as never,
  );

  assert.equal(
    (result.factPatch?.customsClearance as Array<{ customsLight: string }>)[0]
      ?.customsLight,
    'red',
  );
});
