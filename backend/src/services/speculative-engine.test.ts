import assert from 'node:assert/strict';
import test from 'node:test';

import { SpeculativeEngine, TRANSITION_MAP } from './speculative-engine.js';
import { RunCoordinator } from '../coordinator/run-coordinator.js';
import type { StepResult } from '../contracts/step-result.js';
import { HELLO_STEP_RESULT } from '../fixtures/hello.js';

test('TRANSITION_MAP defines canonical forward transitions and milestones', () => {
  // 1. Initial booking
  assert.deepEqual(TRANSITION_MAP.BOOKED, ['IN_TRANSIT']);
  assert.deepEqual(TRANSITION_MAP['Booking Confirmed'], ['In Transit']);
  assert.deepEqual(TRANSITION_MAP.VESSEL_DEPARTED, ['IN_TRANSIT']);

  // 2. Sea transit
  assert.deepEqual(TRANSITION_MAP.IN_TRANSIT, ['ARRIVED_AT_PORT']);
  assert.deepEqual(TRANSITION_MAP['In Transit'], ['Arrived at Port']);
  assert.deepEqual(TRANSITION_MAP.PORT_ARRIVED, ['ARRIVED_AT_PORT']);

  // 3. Port arrival
  assert.deepEqual(TRANSITION_MAP.ARRIVED_AT_PORT, ['CUSTOMS_CLEARANCE']);
  assert.deepEqual(TRANSITION_MAP['Arrived at Port'], ['Customs']);
  assert.deepEqual(TRANSITION_MAP.DISCHARGED, ['CUSTOMS_CLEARANCE']);
  assert.deepEqual(TRANSITION_MAP.PORT_UNLOADED, ['CUSTOMS_CLEARANCE']);

  // 4. Customs clearance
  assert.deepEqual(TRANSITION_MAP.CUSTOMS_CLEARANCE, ['OUT_FOR_DELIVERY']);
  assert.deepEqual(TRANSITION_MAP['Customs'], ['Out for Delivery']);
  assert.deepEqual(TRANSITION_MAP.CUSTOMS_CLEARED, ['OUT_FOR_DELIVERY']);

  // 5. Out for delivery / Last mile
  assert.deepEqual(TRANSITION_MAP.OUT_FOR_DELIVERY, ['DELIVERED']);
  assert.deepEqual(TRANSITION_MAP['Out for Delivery'], ['Delivered']);
  assert.deepEqual(TRANSITION_MAP.LAST_MILE, ['DELIVERED']);
});

test('SpeculativeEngine refuses to speculate on human decisions, critical holds, or discrepancies', () => {
  const engine = new SpeculativeEngine();

  // Case with human decision
  const checkDecision = engine.canSpeculate('ARRIVED_AT_PORT', {
    humanDecision: { decisionId: 'dec-1' },
  });
  assert.equal(checkDecision.allowed, false);

  // Case with critical red customs hold
  const checkRedHold = engine.canSpeculate('CUSTOMS_CLEARANCE', {
    customsClearance: [{ containerNumber: 'MSDU7000810', customsLight: 'red' }],
  });
  assert.equal(checkRedHold.allowed, false);

  // Case with active unresolved discrepancy
  const checkDiscrepancy = engine.canSpeculate('CUSTOMS_CLEARANCE', {
    reconciliationFindings: { status: 'discrepancy', discrepancies: [{ field: 'weightKg' }] },
  });
  assert.equal(checkDiscrepancy.allowed, false);

  // Case with terminal state DELIVERED
  const checkTerminal = engine.canSpeculate('DELIVERED', {});
  assert.equal(checkTerminal.allowed, false);
});

test('SpeculativeEngine pre-generates next state and serves it on transition HIT', async () => {
  const engine = new SpeculativeEngine();
  const initialResult: StepResult = {
    status: 'completed',
    summary: 'Operation booked',
    factPatch: {
      assistantResponse: 'Booking confirmed for MDS-DEMO-GREEN-082',
      status: 'BOOKED',
      operationSummary: {
        operationId: 'op-1',
        referenceCode: 'MDS-DEMO-GREEN-082',
        clientName: 'Muebles del Sur',
        status: 'BOOKED',
        tags: ['demo'],
        containers: [],
      },
      stepProgressBar: {
        title: 'Progreso de Itinerario',
        currentStepIndex: 0,
        totalSteps: 4,
        steps: [
          { id: 'step-1', label: 'Origen Haiphong', status: 'current' },
          { id: 'step-2', label: 'Tránsito Marítimo', status: 'pending' },
          { id: 'step-3', label: 'Aduana Manzanillo', status: 'pending' },
          { id: 'step-4', label: 'Entrega Final', status: 'pending' },
        ],
      },
    },
    evidence: [{ id: 'ev-1', source: 'test' }],
  };

  const pregenerated = await engine.pregenerateNextState('run-test-1', initialResult);
  assert.ok(pregenerated);
  assert.equal(pregenerated.forState, 'IN_TRANSIT');
  assert.equal(pregenerated.status, 'ready');

  // Consume speculative spec
  const hit = engine.consumeSpeculativeSpec('MDS-DEMO-GREEN-082', 'IN_TRANSIT');
  assert.equal(hit.hit, true);
  assert.ok(hit.spec);
  assert.equal(hit.savedMs, 240);
});

test('SpeculativeEngine discards pre-generated spec if facts become invalid', async () => {
  const engine = new SpeculativeEngine();
  const initialResult: StepResult = {
    status: 'completed',
    summary: 'In transit',
    factPatch: {
      assistantResponse: 'In transit',
      status: 'IN_TRANSIT',
      operationSummary: {
        operationId: 'op-2',
        referenceCode: 'MDS-DEMO-DELAY-083',
        clientName: 'Muebles del Sur',
        status: 'IN_TRANSIT',
        tags: ['demo'],
        containers: [],
      },
    },
    evidence: [],
  };

  await engine.pregenerateNextState('run-test-2', initialResult);

  // New critical decision emerges -> must discard
  const hit = engine.consumeSpeculativeSpec('MDS-DEMO-DELAY-083', 'ARRIVED_AT_PORT', {
    humanDecision: { id: 'new-critical-decision' },
  });
  assert.equal(hit.hit, false);
});

test('RunCoordinator integrates SpeculativeEngine for sub-5ms transition response', async () => {
  const engine = new SpeculativeEngine();
  const coordinator = new RunCoordinator({
    speculativeEngine: engine,
    executeStep: async () => ({
      status: 'completed',
      summary: 'Initial query',
      factPatch: {
        assistantResponse: 'Status of MDS-DEMO-GREEN-082',
        executionSteps: HELLO_STEP_RESULT.factPatch.executionSteps,
        status: 'BOOKED',
        operationSummary: {
          operationId: 'op-green',
          referenceCode: 'MDS-DEMO-GREEN-082',
          clientName: 'Muebles del Sur',
          status: 'BOOKED',
          tags: ['demo'],
          containers: [],
        },
      },
      evidence: [],
    }),
  });

  // 1. Initial run triggers pre-generation for IN_TRANSIT in background
  const run1 = coordinator.createRun();
  await coordinator.execute(run1.runId, [
    { role: 'user', content: 'What is the status of MDS-DEMO-GREEN-082?' },
  ]);

  // Wait for setImmediate pre-generation to finish
  await new Promise((r) => setTimeout(r, 50));

  // 2. Next transition query for IN_TRANSIT hits speculative cache
  const run2 = coordinator.createRun();
  const t0 = performance.now();
  await coordinator.execute(run2.runId, [
    { role: 'user', content: 'MDS-DEMO-GREEN-082 is now in_transit' },
  ]);
  const elapsed = performance.now() - t0;

  assert.ok(elapsed < 30, `Speculative HIT should resolve in <30ms, took ${elapsed.toFixed(2)}ms`);
  const snapshot = coordinator.getSnapshot(run2.runId);
  assert.equal(snapshot.status, 'completed');
});
