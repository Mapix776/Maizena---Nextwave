import assert from 'node:assert/strict';
import test from 'node:test';

import { tracerCatalog } from '../contracts/ui.js';
import { HELLO_STEP_RESULT } from '../fixtures/hello.js';
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
    'ContainerProgress',
    'CustomsClearancePanel',
    'DeliveryCard',
    'DeliveryIssueCard',
    'DocumentDetailsCard',
    'EtaRiskCard',
    'HumanDecisionCard',
    'InteractiveChart',
    'InteractiveRouteMap',
    'OperationSummaryCard',
    'OperationalAlertList',
    'OperationsMetricsCard',
    'ReconciliationFindings',
    'ShipmentDocumentsTimeline',
    'ShipmentMilestoneTimeline',
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
    await coordinator.execute(run.runId);

    assert.deepEqual(eventTypes, ['run:status', 'run:complete']);
    assert.deepEqual(coordinator.getSnapshot(run.runId).facts, {});
    assert.equal(coordinator.getSnapshot(run.runId).ui, null);
    assert.equal(coordinator.getSnapshot(run.runId).status, 'failed');
  }
});
