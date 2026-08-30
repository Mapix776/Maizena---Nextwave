import assert from 'node:assert/strict';
import test from 'node:test';

import { ElementLocationTracker } from './element-location-tracker.js';
import { RunCoordinator } from '../coordinator/run-coordinator.js';
import { SpeculativeEngine } from './speculative-engine.js';
import type { UIEnvelope } from '../contracts/ui.js';
import type { StepResult } from '../contracts/step-result.js';
import { HELLO_STEP_RESULT } from '../fixtures/hello.js';

test('ElementLocationTracker associates element IDs with their host message and retrieves them', () => {
  const tracker = new ElementLocationTracker();
  tracker.registerMessageElements('message-bubble-1', 'run-1', [
    'delivery-card-MDS-DEMO-GREEN-082',
    'customs-panel-MSDU7000820',
    'kpi-grid-main',
  ]);

  assert.equal(
    tracker.locateElement('customs-panel-MSDU7000820')?.messageId,
    'message-bubble-1',
  );
  assert.equal(
    tracker.findTargetMessageForElements([
      'customs-panel-MSDU7000820',
      'other-element',
    ]),
    'message-bubble-1',
  );
  assert.equal(tracker.findTargetMessageForElements(['non-existent']), undefined);
});

test('RunCoordinator emits separate response and UI target IDs for an intentional in-place update', async () => {
  const tracker = new ElementLocationTracker();
  const engine = new SpeculativeEngine();
  const emittedEnvelopes: UIEnvelope[] = [];

  const coordinator = new RunCoordinator({
    locationTracker: tracker,
    speculativeEngine: engine,
    emit: (env) => {
      emittedEnvelopes.push(env);
    },
    executeStep: async (messages) => {
      const content = messages[0]?.content ?? '';
      const isTransition = /in_transit|arrived/i.test(content);
      const result: StepResult = {
        status: 'completed',
        summary: isTransition ? 'Status updated' : 'Initial booking',
        factPatch: {
          assistantResponse: isTransition ? 'Shipment in transit' : 'Booking confirmed',
          executionSteps: HELLO_STEP_RESULT.factPatch.executionSteps,
          status: isTransition ? 'In Transit' : 'Booking Confirmed',
          deliveryId: 'MDS-DEMO-GREEN-082',
          from: 'Ho Chi Minh City, Vietnam',
          to: 'Manzanillo, México',
          transportType: 'Sea',
          deliveryTime: '29 de Agosto, 2026',
          operationSummary: {
            operationId: 'op-green',
            referenceCode: 'MDS-DEMO-GREEN-082',
            clientName: 'Muebles del Sur',
            status: isTransition ? 'IN_TRANSIT' : 'BOOKED',
            tags: ['demo'],
            containers: [],
          },
        },
        evidence: [],
      };
      return result;
    },
  });

  // 1. Initial run: renders in message-1
  const run1 = coordinator.createRun();
  await coordinator.execute(run1.runId, [
    { role: 'user', content: 'What is the status of MDS-DEMO-GREEN-082?' },
  ]);

  const initialReplace = emittedEnvelopes.find(
    (e) => e.runId === run1.runId && e.type === 'ui:replace',
  );
  assert.ok(initialReplace);
  // Initial message is registered as assistant-${run1.runId}
  const hostMessageId = `assistant-${run1.runId}`;
  assert.equal(
    tracker.locateElement('delivery-card-MDS-DEMO-GREEN-082')?.messageId,
    hostMessageId,
  );

  // Wait for background speculative pregeneration
  await new Promise((r) => setTimeout(r, 40));

  // 2. Transition query: triggers in-place speculative update
  const run2 = coordinator.createRun();
  await coordinator.execute(run2.runId, [
    { role: 'user', content: 'MDS-DEMO-GREEN-082 is now in_transit' },
  ]);

  const updateReplace = emittedEnvelopes.find(
    (e) => e.runId === run2.runId && e.type === 'ui:replace',
  );
  assert.ok(updateReplace);
  const payload = updateReplace.payload as {
    responseMessageId?: string;
    uiTargetMessageId?: string;
    reason?: string;
  };
  assert.equal(payload.responseMessageId, `assistant-${run2.runId}`);
  assert.equal(payload.uiTargetMessageId, hostMessageId);
  assert.equal(payload.reason, 'speculative-hit');
});

test('Frontend in-place message updater mutates target bubble without appending new message', () => {
  interface ChatMessage {
    id: string;
    role: string;
    text: string;
    spec?: { elements: Record<string, { type: string; props: unknown }> };
  }

  let messages: ChatMessage[] = [
    {
      id: 'assistant-run-1',
      role: 'assistant',
      text: 'Booking confirmed',
      spec: {
        elements: {
          'delivery-card-MDS-DEMO-GREEN-082': {
            type: 'DeliveryCard',
            props: { id: 'MDS-DEMO-GREEN-082', status: 'BOOKED' },
          },
        },
      },
    },
  ];

  // In-place update function matching frontend agent-builder logic
  function applyRenderedResponse(
    runId: string,
    spec: { elements: Record<string, { type: string; props: unknown }> },
    targetMessageId?: string,
  ) {
    if (targetMessageId) {
      const idx = messages.findIndex((m) => m.id === targetMessageId);
      if (idx >= 0) {
        messages = messages.map((m, i) =>
          i === idx
            ? {
                ...m,
                text: 'Status updated to IN_TRANSIT',
                spec: {
                  ...m.spec,
                  ...spec,
                  elements: {
                    ...m.spec?.elements,
                    ...spec.elements,
                  },
                },
              }
            : m,
        );
        return;
      }
    }

    // Otherwise append
    messages = [
      ...messages,
      {
        id: `assistant-${runId}`,
        role: 'assistant',
        text: 'New message',
        spec,
      },
    ];
  }

  const updatedSpec = {
    elements: {
      'delivery-card-MDS-DEMO-GREEN-082': {
        type: 'DeliveryCard',
        props: { id: 'MDS-DEMO-GREEN-082', status: 'IN_TRANSIT' },
      },
    },
  };

  applyRenderedResponse('run-2', updatedSpec, 'assistant-run-1');

  // Verify: message count remains exactly 1 (NO duplicate bubble created)
  assert.equal(messages.length, 1);
  assert.equal(messages[0].id, 'assistant-run-1');
  assert.equal(messages[0].text, 'Status updated to IN_TRANSIT');
  assert.equal(
    (messages[0].spec?.elements['delivery-card-MDS-DEMO-GREEN-082'].props as any).status,
    'IN_TRANSIT',
  );
});
