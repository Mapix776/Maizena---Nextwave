import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createOperationInputSchema,
  SupabaseOperationWriter,
} from './supabase-operations.js';

test('SupabaseOperationWriter writes only the validated operation shape', async () => {
  let request: Request | undefined;
  const writer = new SupabaseOperationWriter({
    url: 'https://example.supabase.co/',
    serviceRoleKey: 'service-role-secret',
    fetch: async (input, init) => {
      request = new Request(input, init);
      return Response.json([
        {
          id: 'operation-1',
          client_name: 'Importadora Atlas',
          reference_code: 'OP-2026-100',
          status: 'BOOKED',
          created_at: '2026-08-29T20:00:00.000Z',
        },
      ]);
    },
  });

  const result = await writer.create(
    createOperationInputSchema.parse({
      clientName: 'Importadora Atlas',
      referenceCode: 'OP-2026-100',
      canonicalData: { origin: 'Cartagena' },
      tags: ['priority'],
    }),
  );

  assert.equal(request?.url, 'https://example.supabase.co/rest/v1/operations');
  assert.equal(request?.headers.get('apikey'), 'service-role-secret');
  assert.deepEqual(await request?.json(), {
    client_name: 'Importadora Atlas',
    reference_code: 'OP-2026-100',
    status: 'BOOKED',
    canonical_data: { origin: 'Cartagena' },
    tags: ['priority'],
    notes: null,
  });
  assert.deepEqual(result, {
    id: 'operation-1',
    clientName: 'Importadora Atlas',
    referenceCode: 'OP-2026-100',
    status: 'BOOKED',
    createdAt: '2026-08-29T20:00:00.000Z',
  });
});

test('operation input rejects unsafe reference codes', () => {
  assert.throws(() =>
    createOperationInputSchema.parse({
      clientName: 'Importadora Atlas',
      referenceCode: 'OP 2026; DROP TABLE operations',
    }),
  );
});

test('SupabaseOperationWriter fails safely when credentials are absent', async () => {
  const writer = new SupabaseOperationWriter({ url: '', serviceRoleKey: '' });
  await assert.rejects(
    writer.create(
      createOperationInputSchema.parse({
        clientName: 'Importadora Atlas',
        referenceCode: 'OP-2026-100',
      }),
    ),
    /Supabase is not configured/,
  );
});
