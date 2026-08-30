import assert from 'node:assert/strict';
import test from 'node:test';

import { tracerCatalog } from '../contracts/ui.js';
import { HELLO_STEP_RESULT } from '../fixtures/hello.js';
import { SpeculativeEngine } from '../services/speculative-engine.js';
import { ElementLocationTracker } from '../services/element-location-tracker.js';
import { RunCoordinator } from './run-coordinator.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('the Work trace commit queue isolates rejection and drains reverse-settled progress before terminal UI', async () => {
  const releaseExecution = deferred<typeof HELLO_STEP_RESULT>();
  const observations: Array<{ type: string; id?: string }> = [];
  const envelopes: Array<{ type: string; sequence: number; payload: any }> = [];
  let rejected = false;
  const firstCorrelation = {};
  const secondCorrelation = {};
  const coordinator = new RunCoordinator({
    executeStep: async (_messages, options) => {
      assert.doesNotThrow(() =>
        options?.traceSink.observe({
          type: 'started',
          correlation: {},
          toolName: 'uncloneableTool',
          input: { callback: () => undefined },
        }),
      );
      assert.equal(
        options?.traceSink.observe({
          type: 'started',
          correlation: firstCorrelation,
          toolName: 'getContainerStatusTool',
          input: { containerNumber: 'PRIVATE-CONTAINER' },
        }),
        undefined,
      );
      options?.traceSink.observe({
        type: 'started',
        correlation: secondCorrelation,
        toolName: 'getContainerStatusTool',
        input: { containerNumber: 'PRIVATE-CONTAINER' },
      });
      options?.traceSink.observe({
        type: 'settled',
        correlation: secondCorrelation,
        outcome: 'completed',
        output: { secret: 'PRIVATE-OUTPUT' },
      });
      options?.traceSink.observe({
        type: 'settled',
        correlation: firstCorrelation,
        outcome: 'completed',
        output: { secret: 'PRIVATE-OUTPUT' },
      });
      return releaseExecution.promise;
    },
    emit: async (envelope) => {
      if (envelope.type === 'work-trace:replace' && !rejected) {
        rejected = true;
        throw new Error('injected emitter rejection');
      }
      envelopes.push(envelope as never);
      if (envelope.type === 'work-trace:replace') {
        observations.push({ type: envelope.type });
      }
    },
    createRunId: () => 'run-queue-proof',
  });
  const run = coordinator.createRun('scope-a');
  const execution = coordinator.execute(run.runId);
  await new Promise<void>((resolve) => setImmediate(resolve));
  releaseExecution.resolve(HELLO_STEP_RESULT);
  await execution;

  assert.equal(rejected, true);
  assert.ok(observations.length >= 4);
  assert.deepEqual(
    envelopes.map(({ sequence }) => sequence),
    envelopes.map((_item, index) => index + 1),
  );
  const finalUi = envelopes.find(({ type }) => type === 'ui:replace');
  assert.ok(finalUi);
  assert.equal(Object.isFrozen(finalUi), true);
  assert.equal(Object.isFrozen(finalUi.payload.workTrace.steps[0]), true);
  assert.equal(finalUi.payload.responseMessageId, 'assistant-run-queue-proof');
  assert.equal(finalUi.payload.workTrace.status, 'completed');
  assert.deepEqual(
    finalUi.payload.workTrace.steps.map((step: any) => ({
      id: step.id,
      status: step.status,
    })),
    [
      { id: 'trace-step-1', status: 'completed' },
      { id: 'trace-step-2', status: 'completed' },
      { id: 'trace-step-3', status: 'completed' },
    ],
  );
  assert.doesNotMatch(
    JSON.stringify(finalUi.payload.workTrace),
    /PRIVATE|toolName|output|timestamp/i,
  );
  const snapshot = coordinator.getSnapshot(run.runId);
  assert.equal(snapshot.sequence, envelopes.at(-1)?.sequence);
  assert.equal(snapshot.status, 'completed');
});

test('document sources appear only after successful observed settlement', async () => {
  const envelopes: Array<{ type: string; payload: any }> = [];
  const completedCorrelation = {};
  const failedCorrelation = {};
  const document = {
    id: '11111111-1111-4111-8111-111111111111',
    file_name: 'Commercial Invoice.pdf',
    mime_type: 'application/pdf',
    storage_bucket: 'private-documents',
    storage_path: 'operations/private/invoice.pdf',
  };
  const coordinator = new RunCoordinator({
    createRunId: () => 'run-document-sources',
    executeStep: async (_messages, options) => {
      options?.traceSink.observe({
        type: 'started', correlation: completedCorrelation,
        toolName: 'readDocumentTool', input: { operationIdOrRef: 'private' },
      });
      options?.traceSink.observe({
        type: 'started', correlation: failedCorrelation,
        toolName: 'getOperationDetailsTool', input: { operationIdOrRef: 'private' },
      });
      options?.traceSink.observe({
        type: 'settled', correlation: completedCorrelation, outcome: 'completed',
        output: { documents: [document] },
      });
      options?.traceSink.observe({
        type: 'settled', correlation: failedCorrelation, outcome: 'failed',
        output: { details: { documents: [document] } },
      });
      return HELLO_STEP_RESULT;
    },
    emit: (envelope) => envelopes.push(envelope as never),
  });
  const run = coordinator.createRun();
  await coordinator.execute(run.runId);

  const projections = envelopes
    .filter(({ type }) => type === 'work-trace:replace')
    .map(({ payload }) => payload.workTrace);
  const beforeSettlement = projections.find((trace) =>
    trace.steps.some((step: any) => step.title === 'Leyendo documento' && step.status === 'running'),
  );
  assert.ok(beforeSettlement);
  assert.equal(beforeSettlement.steps.some((step: any) => step.sources), false);
  const finalTrace = (envelopes.find(({ type }) => type === 'ui:replace') as any).payload.workTrace;
  assert.deepEqual(finalTrace.steps[1].sources, [{
    id: 'trace-source-1',
    title: 'Commercial Invoice.pdf',
    mimeType: 'application/pdf',
    contentUrl: '/api/documents/11111111-1111-4111-8111-111111111111/content',
  }]);
  assert.equal(finalTrace.steps[2].status, 'failed');
  assert.equal(finalTrace.steps[2].sources, undefined);
  assert.doesNotMatch(JSON.stringify(finalTrace), /private-documents|storage_path|storage_bucket/);
});

test('normal terminal projection retries atomically after emitter rejection before publishing target authority', async () => {
  const tracker = new ElementLocationTracker();
  const runIds = ['terminal-retry', 'later-same-scope'];
  const envelopes: Array<{
    runId: string;
    type: string;
    sequence: number;
    payload: any;
  }> = [];
  const observedSnapshots: Array<ReturnType<RunCoordinator['getSnapshot']>> = [];
  let coordinator!: RunCoordinator;
  let rejectedTerminalProjection = false;

  coordinator = new RunCoordinator({
    executeStep: async () => HELLO_STEP_RESULT,
    composeUi: () => ({
      root: 'assistant-message',
      elements: {
        'assistant-message': {
          type: 'AssistantMessage',
          props: { text: 'Atomic terminal response.' },
          children: ['atomic-delivery-card'],
        },
        'atomic-delivery-card': {
          type: 'ContainerProgress',
          props: { currentStatus: 'In Transit' },
          children: [],
        },
      },
    }),
    emit: async (envelope) => {
      observedSnapshots.push(coordinator.getSnapshot(envelope.runId));
      if (
        envelope.runId === 'terminal-retry' &&
        envelope.type === 'ui:replace' &&
        !rejectedTerminalProjection
      ) {
        rejectedTerminalProjection = true;
        assert.equal(
          tracker.locateElement('atomic-delivery-card', 'atomic-scope'),
          undefined,
          'a rejected projection must not publish target authority',
        );
        throw new Error('reject terminal ui:replace once');
      }
      envelopes.push(envelope as never);
    },
    locationTracker: tracker,
    createRunId: () => runIds.shift() ?? 'unexpected-run',
  });

  const first = coordinator.createRun('atomic-scope');
  await coordinator.execute(first.runId);

  const firstSnapshot = coordinator.getSnapshot(first.runId);
  const firstEnvelopes = envelopes.filter(({ runId }) => runId === first.runId);
  assert.equal(rejectedTerminalProjection, true);
  assert.deepEqual(
    firstEnvelopes.map(({ sequence }) => sequence),
    firstEnvelopes.map((_envelope, index) => index + 1),
    'discarded projections do not consume a sequence',
  );
  assert.equal(firstSnapshot.status, 'completed');
  assert.equal(firstSnapshot.sequence, firstEnvelopes.at(-1)?.sequence);
  assert.ok(firstSnapshot.ui?.elements['atomic-delivery-card']);
  assert.equal(firstSnapshot.workTrace?.status, 'completed');
  assert.ok(firstSnapshot.workTrace.durationMs >= 0);
  assert.ok(
    firstSnapshot.workTrace.steps.every(({ status }) => status === 'completed'),
  );
  assert.equal(
    tracker.locateElement('atomic-delivery-card', 'atomic-scope')?.messageId,
    firstSnapshot.responseMessageId,
  );
  assert.ok(
    observedSnapshots.every(
      (snapshot) =>
        snapshot.status !== 'completed' ||
        (snapshot.ui !== null && snapshot.workTrace?.status === 'completed'),
    ),
    'no emitter-visible snapshot combines terminal status with an incomplete projection',
  );

  const later = coordinator.createRun('atomic-scope');
  await coordinator.execute(later.runId);
  const laterUi = envelopes.find(
    ({ runId, type }) => runId === later.runId && type === 'ui:replace',
  );
  assert.equal(laterUi?.payload.uiTargetMessageId, firstSnapshot.responseMessageId);
});

test('an uncommittable terminal projection fails safely without authorizing a later same-scope target', async () => {
  const tracker = new ElementLocationTracker();
  const runIds = ['uncommittable-ui', 'after-uncommittable-ui'];
  const envelopes: Array<{ runId: string; type: string; payload: any }> = [];
  const coordinator = new RunCoordinator({
    executeStep: async () => HELLO_STEP_RESULT,
    composeUi: () => ({
      root: 'assistant-message',
      elements: {
        'assistant-message': {
          type: 'AssistantMessage',
          props: { text: 'Safe fallback response.' },
          children: ['uncommitted-card'],
        },
        'uncommitted-card': {
          type: 'ContainerProgress',
          props: { currentStatus: 'In Transit' },
          children: [],
        },
      },
    }),
    emit: async (envelope) => {
      if (envelope.runId === 'uncommittable-ui' && envelope.type === 'ui:replace') {
        throw new Error('terminal transport remains unavailable');
      }
      envelopes.push(envelope as never);
    },
    locationTracker: tracker,
    createRunId: () => runIds.shift() ?? 'unexpected-run',
  });

  const rejected = coordinator.createRun('uncommittable-scope');
  await coordinator.execute(rejected.runId);
  const rejectedSnapshot = coordinator.getSnapshot(rejected.runId);
  assert.equal(rejectedSnapshot.status, 'failed');
  assert.equal(rejectedSnapshot.ui, null);
  assert.equal(rejectedSnapshot.workTrace?.status, 'failed');
  assert.equal(
    tracker.locateElement('uncommitted-card', 'uncommittable-scope'),
    undefined,
  );

  const later = coordinator.createRun('uncommittable-scope');
  await coordinator.execute(later.runId);
  const laterUi = envelopes.find(
    ({ runId, type }) => runId === later.runId && type === 'ui:replace',
  );
  assert.equal(laterUi?.payload.uiTargetMessageId, `assistant-${later.runId}`);
  assert.notEqual(
    laterUi?.payload.uiTargetMessageId,
    rejectedSnapshot.responseMessageId,
  );
});

test('two-target routing rejects an identical element id outside the run projection scope', async () => {
  const tracker = new ElementLocationTracker();
  tracker.registerMessageElements(
    'assistant-other-scope',
    'older-run',
    ['shared-container-card'],
    'scope-b',
  );
  const envelopes: Array<{ type: string; payload: any }> = [];
  const runIds = ['scoped-run', 'scoped-run-2'];
  const coordinator = new RunCoordinator({
    executeStep: async () => HELLO_STEP_RESULT,
    composeUi: () => ({
      root: 'assistant-message',
      elements: {
        'assistant-message': {
          type: 'AssistantMessage',
          props: { text: 'Safe scoped response.' },
          children: ['shared-container-card'],
        },
        'shared-container-card': {
          type: 'ContainerProgress',
          props: { currentStatus: 'In Transit' },
          children: [],
        },
      },
    }),
    emit: (envelope) => {
      envelopes.push(envelope as never);
    },
    locationTracker: tracker,
    createRunId: () => runIds.shift() ?? 'unexpected-run',
  });
  const run = coordinator.createRun('scope-a');

  await coordinator.execute(run.runId);

  const ui = envelopes.find(({ type }) => type === 'ui:replace');
  assert.equal(ui?.payload.responseMessageId, 'assistant-scoped-run');
  assert.equal(ui?.payload.uiTargetMessageId, 'assistant-scoped-run');
  assert.notEqual(ui?.payload.uiTargetMessageId, 'assistant-other-scope');

  const nextRun = coordinator.createRun('scope-a');
  await coordinator.execute(nextRun.runId);
  const nextUi = envelopes.find(
    ({ type, payload }) =>
      type === 'ui:replace' &&
      payload.responseMessageId === 'assistant-scoped-run-2',
  );
  assert.equal(nextUi?.payload.responseMessageId, 'assistant-scoped-run-2');
  assert.equal(nextUi?.payload.uiTargetMessageId, 'assistant-scoped-run');
});

test('same-scope routing ignores reusable descendants but authorizes the same domain card root', async () => {
  const tracker = new ElementLocationTracker();
  const runIds = ['domain-run-a', 'domain-run-b', 'domain-run-b-update'];
  const deliveryIds = ['DELIVERY-A', 'DELIVERY-B', 'DELIVERY-B'];
  const envelopes: Array<{ runId: string; type: string; payload: any }> = [];
  const coordinator = new RunCoordinator({
    executeStep: async () => HELLO_STEP_RESULT,
    composeUi: () => {
      const deliveryId = deliveryIds.shift() ?? 'UNEXPECTED';
      const cardId = `delivery-card-${deliveryId}`;
      return {
        root: 'assistant-message',
        elements: {
          'assistant-message': {
            type: 'AssistantMessage',
            props: { text: `Response for ${deliveryId}` },
            children: [cardId],
          },
          [cardId]: {
            type: 'DeliveryCard',
            props: {
              id: deliveryId,
              from: 'Cartagena',
              to: 'Bogotá',
              transportType: 'Land',
              status: 'In Transit',
              createdAt: '2026-08-30T10:00:00.000Z',
              deliveryTime: '6 hours',
            },
            children: ['container-progress'],
          },
          'container-progress': {
            type: 'ContainerProgress',
            props: { currentStatus: 'In Transit' },
            children: [],
          },
        },
      };
    },
    emit: (envelope) => {
      envelopes.push(envelope as never);
    },
    locationTracker: tracker,
    createRunId: () => runIds.shift() ?? 'unexpected-run',
  });

  const first = coordinator.createRun('same-scope');
  await coordinator.execute(first.runId);
  const firstSnapshot = coordinator.getSnapshot(first.runId);
  const second = coordinator.createRun('same-scope');
  await coordinator.execute(second.runId);

  const secondUi = envelopes.find(
    ({ runId, type }) => runId === second.runId && type === 'ui:replace',
  );
  assert.equal(secondUi?.payload.responseMessageId, 'assistant-domain-run-b');
  assert.equal(secondUi?.payload.uiTargetMessageId, 'assistant-domain-run-b');
  assert.deepEqual(coordinator.getSnapshot(first.runId), firstSnapshot);
  assert.ok(secondUi?.payload.spec.elements['delivery-card-DELIVERY-B']);
  assert.ok(
    coordinator
      .getSnapshot(second.runId)
      .ui?.elements['delivery-card-DELIVERY-B'],
  );
  assert.equal(
    tracker.locateElement('delivery-card-DELIVERY-A', 'same-scope')?.messageId,
    'assistant-domain-run-a',
  );
  assert.equal(
    tracker.locateElement('delivery-card-DELIVERY-B', 'same-scope')?.messageId,
    'assistant-domain-run-b',
  );
  assert.equal(
    tracker.locateElement('container-progress', 'same-scope'),
    undefined,
  );

  const intentionalUpdate = coordinator.createRun('same-scope');
  await coordinator.execute(intentionalUpdate.runId);
  const updateUi = envelopes.find(
    ({ runId, type }) =>
      runId === intentionalUpdate.runId && type === 'ui:replace',
  );
  assert.equal(
    updateUi?.payload.responseMessageId,
    'assistant-domain-run-b-update',
  );
  assert.equal(updateUi?.payload.uiTargetMessageId, 'assistant-domain-run-b');
  assert.deepEqual(updateUi?.payload.spec.elements['assistant-message'].props, {
    text: 'Response for DELIVERY-B',
  });
  assert.equal(updateUi?.payload.workTrace.status, 'completed');
  assert.equal(
    tracker.locateElement('delivery-card-DELIVERY-B', 'same-scope')?.messageId,
    'assistant-domain-run-b',
  );
  assert.ok(
    coordinator
      .getSnapshot(intentionalUpdate.runId)
      .ui?.elements['delivery-card-DELIVERY-B'],
  );
});

test('normal completion stores and emits one coordinator-measured Work trace', async () => {
  const envelopes: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const clockReadings = [1_000, 5_321];
  const coordinator = new RunCoordinator({
    executeStep: async () => HELLO_STEP_RESULT,
    emit: ({ type, payload }) => {
      envelopes.push({ type, payload: payload as Record<string, unknown> });
    },
    createRunId: () => 'run-measured-trace',
    clock: () => clockReadings.shift() ?? 5_321,
  });

  const run = coordinator.createRun();
  assert.equal(run.workTrace, null);

  await coordinator.execute(run.runId);

  const uiReplace = envelopes.find(({ type }) => type === 'ui:replace');
  const snapshot = coordinator.getSnapshot(run.runId);
  assert.deepEqual(uiReplace?.payload.workTrace, {
    status: 'completed',
    durationMs: 4_321,
    steps: [
      {
        id: 'trace-step-1',
        stepNumber: 1,
        kind: 'thinking',
        status: 'completed',
        animationType: 'thinking',
        title: 'Entendiendo tu solicitud',
        detail: 'Trabajo observable finalizado.',
      },
    ],
  });
  assert.deepEqual(snapshot.workTrace, uiReplace?.payload.workTrace);
  assert.equal(snapshot.uiTargetMessageId, 'assistant-run-measured-trace');
});

test('speculative completion emits the same sanitized Work trace shape', async () => {
  const speculativeEngine = new SpeculativeEngine();
  await speculativeEngine.pregenerateNextState('seed-run', {
    ...HELLO_STEP_RESULT,
    factPatch: {
      ...HELLO_STEP_RESULT.factPatch,
      operationSummary: {
        operationId: 'operation-trace-1',
        referenceCode: 'MDS-DEMO-TRACE-1',
        status: 'BOOKED',
        clientName: 'Trace Test',
        tags: ['test'],
        containers: [],
      },
    },
  });
  const envelopes: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const clockReadings = [200, 275];
  const coordinator = new RunCoordinator({
    speculativeEngine,
    emit: ({ type, payload }) => {
      envelopes.push({ type, payload: payload as Record<string, unknown> });
    },
    createRunId: () => 'run-speculative-trace',
    clock: () => clockReadings.shift() ?? 275,
  });

  const run = coordinator.createRun();
  await coordinator.execute(run.runId, [
    {
      role: 'user',
      content: 'Move MDS-DEMO-TRACE-1 to IN_TRANSIT.',
    },
  ]);

  const uiReplace = envelopes.find(({ type }) => type === 'ui:replace');
  assert.equal(uiReplace?.payload.reason, 'speculative-hit');
  assert.deepEqual(uiReplace?.payload.workTrace, {
    status: 'completed',
    durationMs: 75,
    steps: [
      {
        id: 'trace-step-1',
        stepNumber: 1,
        kind: 'thinking',
        status: 'completed',
        animationType: 'thinking',
        title: 'Aplicando una actualización preparada',
        detail: 'Apliqué una actualización preparada para esta solicitud.',
      },
    ],
  });
  assert.deepEqual(
    coordinator.getSnapshot(run.runId).workTrace,
    uiReplace?.payload.workTrace,
  );
});

test('a failed observed tool and run settle atomically on the same safe response shell', async () => {
  const correlation = {};
  const rawSentinel = 'provider-secret-tool-failure';
  const envelopes: any[] = [];
  const coordinator = new RunCoordinator({
    createRunId: () => 'run-safe-failure',
    executeStep: async (_messages, options) => {
      options?.traceSink.observe({
        type: 'started',
        correlation,
        toolName: 'getContainerStatusTool',
        input: { containerNumber: rawSentinel },
      });
      options?.traceSink.observe({
        type: 'settled',
        correlation,
        outcome: 'failed',
        output: { error: rawSentinel },
      });
      throw new Error(rawSentinel);
    },
    emit: (envelope) => {
      envelopes.push(envelope);
    },
  });

  const run = coordinator.createRun();
  await coordinator.execute(run.runId);

  const terminal = envelopes.at(-1);
  const snapshot = coordinator.getSnapshot(run.runId);
  assert.equal(terminal.type, 'run:complete');
  assert.equal(terminal.payload.status, 'failed');
  assert.equal(terminal.payload.responseMessageId, snapshot.responseMessageId);
  assert.equal(terminal.payload.workTrace.status, 'failed');
  assert.equal(terminal.payload.workTrace.steps.at(-1).status, 'failed');
  assert.equal(terminal.payload.error, 'No pude completar esa respuesta.');
  assert.equal(snapshot.status, 'failed');
  assert.deepEqual(snapshot.workTrace, terminal.payload.workTrace);
  assert.doesNotMatch(JSON.stringify({ terminal, snapshot }), new RegExp(rawSentinel));
});

test('speculative terminal projection uses the same rejecting-emitter atomicity boundary', async () => {
  const speculativeEngine = new SpeculativeEngine();
  await speculativeEngine.pregenerateNextState('speculative-seed', {
    ...HELLO_STEP_RESULT,
    factPatch: {
      ...HELLO_STEP_RESULT.factPatch,
      operationSummary: {
        operationId: 'operation-atomic-speculative',
        referenceCode: 'MDS-DEMO-ATOMIC-2',
        status: 'BOOKED',
        clientName: 'Atomic Speculative Test',
        tags: ['test'],
        containers: [],
      },
    },
  });
  const tracker = new ElementLocationTracker();
  const envelopes: Array<{ type: string; sequence: number; payload: any }> = [];
  let rejectedTerminalProjection = false;
  const coordinator = new RunCoordinator({
    speculativeEngine,
    locationTracker: tracker,
    emit: async (envelope) => {
      if (envelope.type === 'ui:replace' && !rejectedTerminalProjection) {
        rejectedTerminalProjection = true;
        assert.equal(
          tracker.locateElement('operation-summary', 'speculative-scope'),
          undefined,
        );
        throw new Error('reject speculative ui:replace once');
      }
      envelopes.push(envelope as never);
    },
    createRunId: () => 'atomic-speculative-run',
  });

  const run = coordinator.createRun('speculative-scope');
  await coordinator.execute(run.runId, [
    {
      role: 'user',
      content: 'Move MDS-DEMO-ATOMIC-2 to IN_TRANSIT.',
    },
  ]);

  const snapshot = coordinator.getSnapshot(run.runId);
  const uiReplace = envelopes.find(({ type }) => type === 'ui:replace');
  assert.equal(rejectedTerminalProjection, true);
  assert.equal(uiReplace?.payload.reason, 'speculative-hit');
  assert.deepEqual(
    envelopes.map(({ sequence }) => sequence),
    envelopes.map((_envelope, index) => index + 1),
  );
  assert.equal(snapshot.status, 'completed');
  assert.equal(snapshot.sequence, envelopes.at(-1)?.sequence);
  assert.equal(snapshot.workTrace?.status, 'completed');
  assert.ok(snapshot.ui?.elements['operation-summary']);
  assert.equal(
    tracker.locateElement('operation-summary', 'speculative-scope')?.messageId,
    snapshot.responseMessageId,
  );
});

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
    { type: 'work-trace:replace', sequence: 2 },
    { type: 'ui:replace', sequence: 3 },
    { type: 'run:complete', sequence: 4 },
  ]);

  const complete = coordinator.getSnapshot(initial.runId);
  assert.equal(complete.status, 'completed');
  assert.equal(complete.sequence, 4);
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
        executionSteps: HELLO_STEP_RESULT.factPatch.executionSteps,
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
        executionSteps: HELLO_STEP_RESULT.factPatch.executionSteps,
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

  assert.deepEqual(eventTypes, [
    'run:status',
    'work-trace:replace',
    'run:complete',
  ]);
  assert.deepEqual(coordinator.getSnapshot(run.runId).facts, {});
  assert.equal(coordinator.getSnapshot(run.runId).ui, null);
  assert.equal(coordinator.getSnapshot(run.runId).status, 'failed');
  assert.equal(
    coordinator.getSnapshot(run.runId).error,
    'No pude completar esa respuesta.',
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
      [
        'run:status',
        'work-trace:replace',
        'run:complete',
      ],
    );
    const terminalPayload = envelopes.at(-1)?.payload as any;
    assert.equal(terminalPayload.status, 'failed');
    assert.equal(terminalPayload.error, 'No pude completar esa respuesta.');
    assert.equal(terminalPayload.responseMessageId, `assistant-run-${status}`);
    assert.equal(terminalPayload.workTrace.status, 'failed');

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

    assert.deepEqual(eventTypes, [
      'run:status',
      'work-trace:replace',
      'run:complete',
    ]);
    assert.deepEqual(coordinator.getSnapshot(run.runId).facts, {});
    assert.equal(coordinator.getSnapshot(run.runId).ui, null);
    assert.equal(coordinator.getSnapshot(run.runId).status, 'failed');
  }
});
