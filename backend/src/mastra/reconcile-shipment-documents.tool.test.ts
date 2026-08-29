import assert from 'node:assert/strict';
import test from 'node:test';

import { createReconcileShipmentDocumentsTool } from './tools/reconcile-shipment-documents.tool.js';

test('Recon reports BL, invoice, and packing-list discrepancies by severity', async () => {
  const tool = createReconcileShipmentDocumentsTool();
  assert.ok(tool.execute);

  const result = await tool.execute(
    {
      billOfLading: {
        containerNumber: 'MSCU1234567',
        weightKg: 12_000,
        amountUsd: 50_000,
      },
      commercialInvoice: {
        containerNumber: 'MSCU1234567',
        weightKg: 11_950,
        amountUsd: 50_000,
      },
      packingList: {
        containerNumber: 'TGHU7654321',
        weightKg: 12_000,
        amountUsd: 49_800,
      },
    },
    {} as never,
  );

  assert.deepEqual(result, {
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
      {
        field: 'weightKg',
        severity: 'warning',
        values: {
          billOfLading: 12_000,
          commercialInvoice: 11_950,
          packingList: 12_000,
        },
      },
      {
        field: 'amountUsd',
        severity: 'warning',
        values: {
          billOfLading: 50_000,
          commercialInvoice: 50_000,
          packingList: 49_800,
        },
      },
    ],
  });
});
