import assert from 'node:assert/strict';
import test from 'node:test';

import {
  containerStatusOutputSchema,
  customsStatusOutputSchema,
  operationDetailsOutputSchema,
  operationalAlertsOutputSchema,
  operationsListOutputSchema,
  operationsSummaryOutputSchema,
  pendingDecisionsOutputSchema,
  searchCargoOutputSchema,
  universalSearchOutputSchema,
} from './tools/logistics-database.tools.js';

test('every logistics tool rejects malformed nested database results', () => {
  const invalidOutputs: Array<[string, boolean]> = [
    [
      'search cargo',
      searchCargoOutputSchema.safeParse({ matchedCount: 1, results: [{}] }).success,
    ],
    [
      'operation details',
      operationDetailsOutputSchema.safeParse({ found: true, details: {} }).success,
    ],
    [
      'operations list',
      operationsListOutputSchema.safeParse({ count: 1, operations: [{}] }).success,
    ],
    [
      'container status',
      containerStatusOutputSchema.safeParse({ found: true, container: {} }).success,
    ],
    [
      'customs status',
      customsStatusOutputSchema.safeParse({ count: 1, containers: [{}] }).success,
    ],
    [
      'alerts',
      operationalAlertsOutputSchema.safeParse({ count: 1, alerts: [{}] }).success,
    ],
    [
      'decisions',
      pendingDecisionsOutputSchema.safeParse({ count: 1, decisions: [{}] }).success,
    ],
    [
      'metrics',
      operationsSummaryOutputSchema.safeParse({ summary: {} }).success,
    ],
    [
      'universal search',
      universalSearchOutputSchema.safeParse({ results: { operations: [{}] } }).success,
    ],
  ];

  assert.deepEqual(
    invalidOutputs.filter(([, accepted]) => accepted).map(([name]) => name),
    [],
  );
});
