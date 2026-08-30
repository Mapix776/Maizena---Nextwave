import assert from 'node:assert/strict';
import test from 'node:test';

import { tracerCatalog } from '../contracts/ui.js';
import { HELLO_STEP_RESULT } from '../fixtures/hello.js';
import { composeRunUi } from '../services/ui-composer.js';
import { RunCoordinator } from './run-coordinator.js';

test('RunCoordinator validates and emits one monotonic envelope sequence', async () => {
  const envelopes: Array<{ type: string; sequence: number }> = [];
  const coordinator = new RunCoordinator({
    executeStep: async () => HELLO_STEP_RESULT,
    emit: (envelope) => {
      envelopes.push({ type: envelope.type, sequence: envelope.sequence });
    },
    createRunId: () => 'run-order',
    now: () => new Date('2026-08-29T20:00:00.000Z'),
  });

  const initial = coordinator.createRun();
  await coordinator.execute(initial.runId);

  assert.deepEqual(envelopes, [
    { type: 'run:status', sequence: 1 },
    { type: 'ui:replace', sequence: 2 },
    { type: 'run:complete', sequence: 3 },
  ]);

  const complete = coordinator.getSnapshot(initial.runId);
  assert.equal(complete.status, 'completed');
  assert.equal(complete.sequence, 3);
  assert.equal(complete.facts.greeting, 'Hello from Ari');
  assert.ok(complete.ui);
  assert.deepEqual([...tracerCatalog.componentNames].sort(), [
    'AgentRunTimeline',
    'AssistantMessage',
    'ComparisonTable',
    'ContainerProgress',
    'CustomsClearancePanel',
    'DeliveryCard',
    'DeliveryIssueCard',
    'DocumentDetailsCard',
    'EtaRiskCard',
    'HumanDecisionCard',
    'InteractiveChart',
    'InteractiveRouteMap',
    'KpiGrid',
    'OperationSummaryCard',
    'OperationalAlertList',
    'OperationsMetricsCard',
    'ReconciliationFindings',
    'ShipmentDocumentsTimeline',
    'ShipmentMilestoneTimeline',
    'StepProgressBar',
  ]);
  assert.ok(
    Object.values(complete.ui.elements).every(({ type }) =>
      tracerCatalog.componentNames.includes(type),
    ),
  );
  assert.deepEqual(complete.ui.elements[complete.ui.root]?.children, []);
  assert.match(JSON.stringify(complete.ui), /Hello from Ari/);
});

test('RunCoordinator renders evidence-backed reconciliation findings', async () => {
  const coordinator = new RunCoordinator({
    executeStep: async () => ({
      status: 'completed',
      summary: 'Recon found one critical discrepancy.',
      factPatch: {
        assistantResponse: 'Recon found one critical discrepancy.',
        reconciliationFindings: {
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
          evidenceIds: ['reconciliation-tool-result'],
        },
      },
      evidence: [
        {
          id: 'reconciliation-tool-result',
          source: 'mastra:recon/reconcileShipmentDocumentsTool',
        },
      ],
    }),
    createRunId: () => 'run-reconciliation',
  });

  const run = coordinator.createRun();
  await coordinator.execute(run.runId);

  const complete = coordinator.getSnapshot(run.runId);
  assert.equal(complete.status, 'completed');
  assert.ok(complete.ui);
  assert.deepEqual(complete.ui.elements[complete.ui.root]?.children, [
    'reconciliation-findings',
  ]);
  assert.deepEqual(complete.ui.elements['reconciliation-findings'], {
    type: 'ReconciliationFindings',
    props: {
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
      evidenceIds: ['reconciliation-tool-result'],
    },
    children: [],
  });
});

test('a required human decision remains primary when reconciliation facts are also present', async () => {
  const coordinator = new RunCoordinator({
    executeStep: async () => ({
      status: 'completed',
      summary: 'Choose how to resolve the discrepancy.',
      factPatch: {
        humanDecision: {
          title: 'Container mismatch',
          question: 'Which document should be treated as authoritative?',
          severity: 'critical',
          options: [
            {
              id: 'use-bol',
              label: 'Use Bill of Lading',
              description: 'Continue with the container on the BL.',
            },
          ],
        },
        reconciliationFindings: {
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
          evidenceIds: ['reconciliation-tool-result'],
        },
      },
      evidence: [
        {
          id: 'reconciliation-tool-result',
          source: 'mastra:recon/reconcileShipmentDocumentsTool',
        },
      ],
    }),
    createRunId: () => 'run-reconciliation-decision',
  });

  const run = coordinator.createRun();
  await coordinator.execute(run.runId);

  const complete = coordinator.getSnapshot(run.runId);
  assert.equal(complete.status, 'completed');
  assert.deepEqual(complete.ui?.elements[complete.ui.root]?.children, [
    'decision-card',
    'reconciliation-findings',
  ]);
  assert.equal(complete.ui?.elements['decision-card']?.type, 'HumanDecisionCard');
  assert.deepEqual(
    complete.facts.reconciliationFindings,
    {
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
      evidenceIds: ['reconciliation-tool-result'],
    },
  );
});

test('invalid reconciliation facts never mutate run state or emit UI', async () => {
  const eventTypes: string[] = [];
  const coordinator = new RunCoordinator({
    executeStep: async () => ({
      status: 'completed',
      summary: 'Untrusted reconciliation result.',
      factPatch: {
        reconciliationFindings: {
          status: 'discrepancy',
          severity: 'critical',
          discrepancies: [],
          evidenceIds: [],
        },
      },
      evidence: [],
    }),
    emit: ({ type }) => {
      eventTypes.push(type);
    },
    createRunId: () => 'run-invalid-reconciliation',
  });

  const run = coordinator.createRun();
  await coordinator.execute(run.runId);

  assert.deepEqual(eventTypes, ['run:status', 'run:complete']);
  assert.deepEqual(coordinator.getSnapshot(run.runId).facts, {});
  assert.equal(coordinator.getSnapshot(run.runId).ui, null);
  assert.equal(coordinator.getSnapshot(run.runId).status, 'failed');
  assert.equal(
    coordinator.getSnapshot(run.runId).error,
    'Invalid reconciliation findings fact',
  );
});

test('non-success StepResults cannot mutate facts or complete successfully', async () => {
  for (const status of ['failed', 'skipped', 'waiting_human'] as const) {
    const envelopes: Array<{ type: string; payload: unknown }> = [];
    const coordinator = new RunCoordinator({
      executeStep: async () => ({
        ...HELLO_STEP_RESULT,
        status,
      }),
      emit: ({ type, payload }) => {
        envelopes.push({ type, payload });
      },
      createRunId: () => `run-${status}`,
    });

    const run = coordinator.createRun();
    await coordinator.execute(run.runId);

    assert.deepEqual(
      envelopes.map(({ type }) => type),
      ['run:status', 'run:complete'],
    );
    assert.deepEqual(envelopes.at(-1)?.payload, {
      status: 'failed',
      error: 'Invalid StepResult',
    });

    const failed = coordinator.getSnapshot(run.runId);
    assert.equal(failed.status, 'failed');
    assert.deepEqual(failed.facts, {});
    assert.equal(failed.ui, null);
  }
});

test('invalid component trees never mutate facts or emit ui:replace', async () => {
  const invalidTrees = [
    {
      root: 'bad',
      elements: {
        bad: { type: 'UnknownComponent', props: {}, children: [] },
      },
    },
    {
      root: 'bad',
      elements: {
        bad: {
          type: 'DeliveryCard',
          props: {
            id: 'Hello from Ari',
            from: 'Cartagena',
            to: 'Bogotá',
            transportType: 'Land',
            status: 'Not a delivery status',
            createdAt: '2026-08-29T20:00:00.000Z',
            deliveryTime: '6 hours',
          },
          children: [],
        },
      },
    },
    {
      root: 'bad',
      elements: {
        bad: {
          type: 'ContainerProgress',
          props: { currentStatus: 'Not a delivery status' },
          children: [],
        },
      },
    },
    {
      root: 'missing-root',
      elements: {
        bad: {
          type: 'ContainerProgress',
          props: { currentStatus: 'In Transit' },
          children: [],
        },
      },
    },
    {
      root: 'bad',
      elements: {
        bad: {
          type: 'DeliveryCard',
          props: {
            id: 'Hello from Ari',
            from: 'Cartagena',
            to: 'Bogotá',
            transportType: 'Land',
            status: 'In Transit',
            createdAt: '2026-08-29T20:00:00.000Z',
            deliveryTime: '6 hours',
          },
          children: ['missing-child'],
        },
      },
    },
  ];

  for (const [index, tree] of invalidTrees.entries()) {
    const eventTypes: string[] = [];
    const coordinator = new RunCoordinator({
      executeStep: async () => HELLO_STEP_RESULT,
      composeUi: () => tree,
      emit: ({ type }) => {
        eventTypes.push(type);
      },
      createRunId: () => `invalid-${index}`,
    });

    const run = coordinator.createRun();
  }
});

test('invalid component trees never mutate facts or emit ui:replace', async () => {
  const invalidTrees = [
    {
      root: 'bad',
      elements: {
        bad: { type: 'UnknownComponent', props: {}, children: [] },
      },
    },
    {
      root: 'bad',
      elements: {
        bad: {
          type: 'DeliveryCard',
          props: {
            id: 'Hello from Ari',
            from: 'Cartagena',
            to: 'Bogotá',
            transportType: 'Land',
            status: 'Not a delivery status',
            createdAt: '2026-08-29T20:00:00.000Z',
            deliveryTime: '6 hours',
          },
          children: [],
        },
      },
    },
    {
      root: 'bad',
      elements: {
        bad: {
          type: 'ContainerProgress',
          props: { currentStatus: 'Not a delivery status' },
          children: [],
        },
      },
    },
    {
      root: 'missing-root',
      elements: {
        bad: {
          type: 'ContainerProgress',
          props: { currentStatus: 'In Transit' },
          children: [],
        },
      },
    },
    {
      root: 'bad',
      elements: {
        bad: {
          type: 'DeliveryCard',
          props: {
            id: 'Hello from Ari',
            from: 'Cartagena',
            to: 'Bogotá',
            transportType: 'Land',
            status: 'In Transit',
            createdAt: '2026-08-29T20:00:00.000Z',
            deliveryTime: '6 hours',
          },
          children: ['missing-child'],
        },
      },
    },
  ];

  for (const [index, tree] of invalidTrees.entries()) {
    const eventTypes: string[] = [];
    const coordinator = new RunCoordinator({
      executeStep: async () => HELLO_STEP_RESULT,
      composeUi: () => tree,
      emit: ({ type }) => {
        eventTypes.push(type);
      },
      createRunId: () => `invalid-${index}`,
    });

    const run = coordinator.createRun();
    await coordinator.execute(run.runId);

    assert.deepEqual(eventTypes, ['run:status', 'run:complete']);
    assert.deepEqual(coordinator.getSnapshot(run.runId).facts, {});
    assert.equal(coordinator.getSnapshot(run.runId).ui, null);
    assert.equal(coordinator.getSnapshot(run.runId).status, 'failed');
  }
});

test('RunCoordinator clears transient humanDecision when subsequent turn resolves decision', async () => {
  let turn = 1;
  const coordinator = new RunCoordinator({
    executeStep: async () => {
      if (turn === 1) {
        return {
          status: 'completed',
          summary: 'Decision required',
          factPatch: {
            assistantResponse: 'Please choose how to handle the delay.',
            humanDecision: {
              title: 'Choose customs response',
              question: 'How should Ari handle the red-light inspection?',
              severity: 'critical',
              options: [
                { id: 'opt-1', label: 'Notify all parties about the delay' },
                { id: 'opt-2', label: 'Assign broker' },
              ],
            },
          },
          evidence: [{ id: 'ev-1', source: 'test' }],
        };
      }
      return {
        status: 'completed',
        summary: 'Decision resolved',
        factPatch: {
          assistantResponse: 'Action executed: Notification sent to all parties.',
        },
        evidence: [{ id: 'ev-2', source: 'test' }],
      };
    },
    emit: () => {},
    createRunId: () => 'run-decision-loop-test',
  });

  const run = coordinator.createRun();
  // Turn 1: presents decision
  await coordinator.execute(run.runId, [{ role: 'user', content: 'Show decisions' }]);
  let snapshot = coordinator.getSnapshot(run.runId);
  assert.ok(snapshot.facts.humanDecision, 'Turn 1 should have humanDecision');
  assert.ok(
    Object.values((snapshot.ui as any).elements).some((el: any) => el.type === 'HumanDecisionCard'),
    'Turn 1 UI must contain HumanDecisionCard',
  );

  // Turn 2: user selects option -> must resolve and NOT show HumanDecisionCard again
  turn = 2;
  await coordinator.execute(run.runId, [
    { role: 'user', content: 'The user selected: "Notify all parties about the delay"' },
  ]);
  snapshot = coordinator.getSnapshot(run.runId);
  assert.equal(
    snapshot.facts.humanDecision,
    undefined,
    'Turn 2 must clear transient humanDecision',
  );
  assert.ok(
    !Object.values((snapshot.ui as any).elements).some((el: any) => el.type === 'HumanDecisionCard'),
    'Turn 2 UI must NOT contain HumanDecisionCard',
  );
});

test('RunCoordinator emits incremental ui:replace patches in real time as each tool resolves', async () => {
  const emittedEnvelopes: Array<{ type: string; payload: any }> = [];

  const coordinator = new RunCoordinator({
    executeStep: async (_messages, onPartialPatch) => {
      // Simulate tool 1 resolving
      await onPartialPatch?.(
        {
          operationSummary: {
            operationId: 'op-123',
            referenceCode: 'OP-2026-PARTIAL',
            clientName: 'Partial Client',
            status: 'BOOKED',
            tags: [],
            containers: [
              {
                id: 'cont-1',
                containerNumber: 'CONT-999',
                status: 'CLEARED',
                originPort: 'Shanghai',
                destinationPort: 'Manzanillo',
              },
            ],
          },
        },
        { id: 'trace-1', title: 'Tool 1 Resolved', detail: 'Operation details loaded', status: 'completed' },
      );

      // Simulate tool 2 resolving
      await onPartialPatch?.(
        {
          customsClearance: [
            {
              containerNumber: 'CONT-999',
              status: 'CLEARED',
              customsLight: 'green',
              currentLocation: 'Manzanillo',
              previoStatus: 'completed',
              pedimentoStatus: 'completed',
              alertIds: [],
              decisionIds: [],
            },
          ],
        },
        { id: 'trace-2', title: 'Tool 2 Resolved', detail: 'Customs status loaded', status: 'completed' },
      );

      return {
        status: 'completed',
        summary: 'Final summary after all tools.',
        factPatch: {
          assistantResponse: 'Final summary after all tools.',
        },
        evidence: [],
      };
    },
    composeUi: composeRunUi,
    emit: (envelope) => {
      emittedEnvelopes.push({ type: envelope.type, payload: envelope.payload });
    },
    createRunId: () => 'partial-run-test',
  });

  const run = coordinator.createRun();
  await coordinator.execute(run.runId, [{ role: 'user', content: 'test partial' }]);

  const partialEvents = emittedEnvelopes.filter(
    (e) => e.type === 'ui:replace' && e.payload?.reason === 'partial-tool-resolved',
  );
  const completeEvent = emittedEnvelopes.find(
    (e) => e.type === 'ui:replace' && e.payload?.reason === 'step-complete',
  );

  assert.equal(partialEvents.length, 2, 'Must emit 2 partial ui:replace events');
  assert.ok(completeEvent, 'Must emit final step-complete ui:replace event');

  // Verify first patch had OperationSummaryCard
  const firstSpecElements = Object.values(partialEvents[0].payload.spec.elements).map((el: any) => el.type);
  assert.ok(firstSpecElements.includes('OperationSummaryCard'));

  // Verify second patch had CustomsClearancePanel added
  const secondSpecElements = Object.values(partialEvents[1].payload.spec.elements).map((el: any) => el.type);
  assert.ok(secondSpecElements.includes('OperationSummaryCard'));
  assert.ok(secondSpecElements.includes('CustomsClearancePanel'));
});

