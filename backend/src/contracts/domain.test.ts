import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDocumentStoragePath,
  DocumentAssociationSchema,
  DocumentTypeSchema,
} from './domain.js';

test('DocumentTypeSchema covers every database document enum value', () => {
  assert.deepEqual(DocumentTypeSchema.options, [
    'PURCHASE_ORDER',
    'BOOKING_CONFIRMATION',
    'BILL_OF_LADING',
    'COMMERCIAL_INVOICE',
    'PACKING_LIST',
    'CUSTOMS_DECLARATION',
    'EMAIL_UPDATE',
    'ARRIVAL_NOTICE',
    'BL_REVALIDATION',
    'PREVIO_REPORT',
    'PEDIMENTO',
    'DELIVERY_ORDER',
    'EXPENSE_ACCOUNT',
    'OTHER',
  ]);
});

test('buildDocumentStoragePath organizes documents by operation and type', () => {
  assert.equal(
    buildDocumentStoragePath({
      operationId: '35556da1-7709-46ad-a86f-784478fb330f',
      documentType: 'BILL_OF_LADING',
      fileName: '03_Bill_of_Lading_MSCUBL7749201MX.pdf',
    }),
    'operations/35556da1-7709-46ad-a86f-784478fb330f/bills-of-lading/03_Bill_of_Lading_MSCUBL7749201MX.pdf',
  );
});

test('buildDocumentStoragePath rejects file names that could escape the document folder', () => {
  assert.throws(() =>
    buildDocumentStoragePath({
      operationId: '35556da1-7709-46ad-a86f-784478fb330f',
      documentType: 'PACKING_LIST',
      fileName: '../packing-list.pdf',
    }),
  );
});

test('DocumentAssociationSchema keeps every party explicitly tied to a document operation', () => {
  const association = DocumentAssociationSchema.parse({
    operationId: '35556da1-7709-46ad-a86f-784478fb330f',
    documentType: 'BOOKING_CONFIRMATION',
    documentReference: 'MSCUBK7749201',
    parties: [
      {
        partyRole: 'CARRIER',
        partyName: 'Mediterranean Shipping Company (MSC)',
      },
    ],
  });

  assert.equal(association.parties[0]?.partyRole, 'CARRIER');
  assert.equal(association.parties[0]?.partyReference, null);
});
