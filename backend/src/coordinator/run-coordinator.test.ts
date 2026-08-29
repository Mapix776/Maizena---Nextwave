import assert from 'node:assert/strict';
import test from 'node:test';

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
          type: 'Text',
          props: { text: 'Hello from Ari', tone: 'not-a-tone' },
          children: [],
        },
      },
    },
    {
      root: 'missing-root',
      elements: {
        bad: {
          type: 'Text',
          props: { text: 'Hello from Ari', tone: 'success' },
          children: [],
        },
      },
    },
    {
      root: 'bad',
      elements: {
        bad: {
          type: 'Stack',
          props: { gap: 'md' },
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
