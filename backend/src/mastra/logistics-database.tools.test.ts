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

test('readDocumentTool accepts BOOKING_CONFIRMATION and returns operation documents', async () => {
  const { createReadDocumentTool } = await import('./tools/read-document.tool.js');
  const mockReader = {
    getOperationByReferenceOrId: async (ref: string) => {
      if (ref === 'OP-2026-9201' || ref === 'current') {
        return { id: 'op-9201', reference_code: 'OP-2026-9201', client_name: 'Muebles del Sur', status: 'BOOKED', tags: [], canonical_data: {}, created_at: '', updated_at: '' };
      }
      return null;
    },
    getDocumentsByOperation: async (opId: string, type?: string) => {
      if (opId === 'op-9201' && (!type || type === 'BOOKING_CONFIRMATION')) {
        return [
          {
            id: 'doc-bk-1',
            operation_id: 'op-9201',
            type: 'BOOKING_CONFIRMATION',
            document_reference: 'BK-MUEBLES-2026',
            file_name: 'Booking_Confirmation_Muebles_del_Sur.pdf',
            extracted_facts: { confidence: 0.96 },
            processing_status: 'PARSED',
            created_at: '2026-08-30T00:00:00Z',
          },
        ];
      }
      return [];
    },
    getDocumentByReference: async () => null,
  } as any;

  const tool: any = createReadDocumentTool({ reader: mockReader });
  const result: any = await tool.execute({
    operationIdOrRef: 'OP-2026-9201',
    documentType: 'BOOKING_CONFIRMATION',
  });

  assert.equal(result.found, true);
  assert.equal(result.count, 1);
  assert.equal(result.documents[0].type, 'BOOKING_CONFIRMATION');
  assert.equal(result.documents[0].document_reference, 'BK-MUEBLES-2026');

  const emptyResult: any = await tool.execute({
    operationIdOrRef: 'non-existent-op',
  });
  assert.equal(emptyResult.found, false);
  assert.equal(emptyResult.count, 0);
});

