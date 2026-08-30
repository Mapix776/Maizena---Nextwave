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
