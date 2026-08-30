import test from 'node:test';
import assert from 'node:assert/strict';
import { DocumentExtractorService } from './document-extractor.js';

test('DocumentExtractorService parses booking confirmation text and extracts facts', async () => {
  const extractor = new DocumentExtractorService();
  const sampleText = `
    BOOKING CONFIRMATION
    Booking Ref: BK-VN-2026-99
    Shipper: Vietnam Teakwood Craft Co.
    Consignee: Muebles del Sur S.A. de C.V.
    Port of Loading: Haiphong, Vietnam
    Port of Discharge: Manzanillo, Mexico
    Vessel: MAERSK MC-KINNEY
    Container: MSKU9911223 (40HC)
    Cargo: 50 Sets of Solid Wood Dining Tables
    Declared Value: $22,500 USD
  `;

  const parsed = extractor.parseContent('Booking_Confirmation_VN.pdf', sampleText);

  assert.equal(parsed.documentType, 'BOOKING_CONFIRMATION');
  assert.equal(parsed.documentReference, 'BK-VN-2026-99');
  assert.equal(parsed.clientName, 'Muebles del Sur');
  assert.equal(parsed.originPort, 'Haiphong, Vietnam');
  assert.equal(parsed.destinationPort, 'Manzanillo, Mexico');
  assert.equal(parsed.containers[0].containerNumber, 'MSKU9911223');
  assert.equal(parsed.items[0].quantity, 50);
});

test('DocumentExtractorService does not invent missing cargo or container facts', () => {
  const extractor = new DocumentExtractorService();
  const parsed = extractor.parseContent('Booking.pdf', 'BOOKING CONFIRMATION\nBooking Ref: BK-001');

  assert.deepEqual(parsed.containers, []);
  assert.deepEqual(parsed.items, []);
  assert.equal(parsed.originPort, '');
  assert.equal(parsed.destinationPort, '');
});

test('DocumentExtractorService rejects unsupported uploads before any persistence', async () => {
  const extractor = new DocumentExtractorService();

  await assert.rejects(
    () =>
      extractor.ingestDocument({
        fileName: 'Commercial_Invoice_INV-44.pdf',
        fileContentText: 'COMMERCIAL INVOICE Invoice No: INV-44',
      }),
    /only a Purchase Order, Booking Confirmation, Bill of Lading, Packing List, or Arrival Notice/i,
  );
});

test('DocumentExtractorService rejects attempts to relabel uploaded content', async () => {
  const extractor = new DocumentExtractorService();

  await assert.rejects(
    () =>
      extractor.ingestDocument({
        fileName: 'Invoice_INV-44.pdf',
        fileContentText: 'COMMERCIAL INVOICE Invoice No: INV-44',
        overrideData: { documentType: 'BILL_OF_LADING' },
      }),
    /does not match the detected document content/i,
  );
});

test('DocumentExtractorService identifies an arrival notice as an accepted upload type', () => {
  const extractor = new DocumentExtractorService();
  const parsed = extractor.parseContent(
    'Arrival_Notice_MSCUBL7749201MX.pdf',
    'ARRIVAL NOTICE BL No: MSCUBL7749201MX',
  );

  assert.equal(parsed.documentType, 'ARRIVAL_NOTICE');
});
