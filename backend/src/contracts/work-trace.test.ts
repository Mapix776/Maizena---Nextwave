import assert from 'node:assert/strict';
import test from 'node:test';

import { mapToolToTraceStep } from './trace-step.js';
import {
  createWorkTrace,
  extractWorkTraceSources,
  workTraceSchema,
} from './work-trace.js';

const timestamp = '2026-08-30T12:00:00.000Z';

test('createWorkTrace orders and projects only safe presentation fields', () => {
  const trace = createWorkTrace({
    durationMs: 4_499.6,
    executionSteps: [
      {
        id: 'tool-step',
        stepNumber: 2,
        kind: 'querying_database',
        animationType: 'thinking',
        title: 'Consultando operación',
        detail: 'Revisé el estado confirmado de la operación.',
        toolName: 'getOperationDetailsTool',
        input: { operationIdOrRef: 'OP-PRIVATE' },
        outputSummary: 'Raw provider result',
        durationMs: 999,
        timestamp,
      },
      {
        id: 'thinking-step',
        stepNumber: 1,
        kind: 'thinking',
        animationType: 'thinking',
        title: 'Entendiendo tu solicitud',
        detail: 'Organicé la consulta antes de revisar datos.',
        durationMs: 25,
        timestamp,
      },
    ],
  });

  assert.deepEqual(trace, {
    status: 'completed',
    durationMs: 4_500,
    steps: [
      {
        id: 'trace-step-1',
        stepNumber: 1,
        kind: 'thinking',
        status: 'completed',
        animationType: 'thinking',
        title: 'Entendiendo tu solicitud',
        detail: 'Organicé la consulta antes de revisar datos.',
      },
      {
        id: 'trace-step-2',
        stepNumber: 2,
        kind: 'querying_database',
        status: 'completed',
        animationType: 'thinking',
        title: 'Consultando operación',
        detail: 'Revisé el estado confirmado de la operación.',
      },
    ],
  });
  assert.doesNotMatch(
    JSON.stringify(trace),
    /toolName|input|outputSummary|timestamp|OP-PRIVATE|provider/i,
  );
});

test('the public Work trace contract is bounded, lifecycle-explicit, and strict', () => {
  const step = {
    id: 'trace-step-1',
    stepNumber: 1,
    kind: 'thinking',
    status: 'running',
    animationType: 'thinking',
    title: 'Preparando respuesta',
    detail: 'Organizando la solicitud.',
  };

  assert.equal(
    workTraceSchema.safeParse({
      status: 'running',
      durationMs: 0,
      steps: [step],
    }).success,
    true,
  );
  assert.equal(
    workTraceSchema.safeParse({
      status: 'running',
      durationMs: 0,
      steps: [{ ...step, id: 'step-1-toolName' }],
    }).success,
    false,
  );
  assert.equal(
    workTraceSchema.safeParse({
      status: 'running',
      durationMs: 0,
      steps: [{ ...step, toolName: 'privateTool' }],
    }).success,
    false,
  );
  assert.equal(
    workTraceSchema.safeParse({
      status: 'running',
      durationMs: 0,
      steps: Array.from({ length: 33 }, (_, index) => ({
        ...step,
        id: `trace-step-${index + 1}`,
        stepNumber: index + 1,
      })),
    }).success,
    false,
  );
  assert.equal(
    workTraceSchema.safeParse({
      status: 'running',
      durationMs: 0,
      steps: [step, { ...step }],
    }).success,
    false,
  );
});

test('createWorkTrace clamps negative measured duration to zero', () => {
  const trace = createWorkTrace({
    durationMs: -4.7,
    executionSteps: [
      {
        id: 'thinking-step',
        stepNumber: 1,
        kind: 'thinking',
        animationType: 'thinking',
        title: 'Entendiendo tu solicitud',
        detail: 'Organicé la consulta.',
        durationMs: 25,
        timestamp,
      },
    ],
  });

  assert.equal(trace.durationMs, 0);
});

test('createWorkTrace rejects empty or malformed internal steps', () => {
  assert.throws(() =>
    createWorkTrace({ durationMs: 10, executionSteps: [] }),
  );
  assert.throws(() =>
    createWorkTrace({
      durationMs: 10,
      executionSteps: [{ id: 'unsafe-incomplete-step' }],
    }),
  );
});

test('createWorkTrace preserves distinct safe backend summaries for every ordered step', () => {
  const trace = createWorkTrace({
    durationMs: 1_000,
    executionSteps: [
      {
        id: 'trace-step-1',
        stepNumber: 1,
        kind: 'querying_database',
        animationType: 'thinking',
        title: 'Revisando estatus de aduana',
        detail:
          'Verifiqué el semáforo fiscal y confirmé que la carga no requiere inspección.',
        toolName: 'getCustomsStatusTool',
        input: { operationReference: 'SAFE-NOT-IN-SUMMARY' },
        durationMs: 20,
        timestamp,
      },
      {
        id: 'trace-step-2',
        stepNumber: 2,
        kind: 'querying_database',
        animationType: 'thinking',
        title: 'Comprobando alertas operativas',
        detail:
          'Revisé el monitor de incidentes y encontré tres alertas activas.',
        toolName: 'getOperationalAlertsTool',
        input: {},
        durationMs: 20,
        timestamp,
      },
    ],
  });

  assert.deepEqual(
    trace.steps.map(({ id, title, detail }) => ({ id, title, detail })),
    [
      {
        id: 'trace-step-1',
        title: 'Revisando estatus de aduana',
        detail:
          'Verifiqué el semáforo fiscal y confirmé que la carga no requiere inspección.',
      },
      {
        id: 'trace-step-2',
        title: 'Comprobando alertas operativas',
        detail:
          'Revisé el monitor de incidentes y encontré tres alertas activas.',
      },
    ],
  );
});

test('createWorkTrace sanitizes source values while preserving useful summaries and order', () => {
  const shipmentSentinel = 'SHIPMENT-SENTINEL-7788';
  const documentSentinel = 'DOCUMENT-SENTINEL-9911';
  const containerSentinel = 'CONTAINER-SENTINEL-4455';
  const rawQuerySentinel = 'midnight velvet chairs for private client';
  const trace = createWorkTrace({
    durationMs: 2_000,
    executionSteps: [
      {
        id: 'trace-step-1',
        stepNumber: 1,
        kind: 'reading_document',
        animationType: 'reading',
        title: `Leyendo ${documentSentinel}`,
        detail: `Abrí el documento ${documentSentinel} para ${shipmentSentinel}.`,
        toolName: 'readDocumentTool',
        input: {
          documentIdOrRef: documentSentinel,
          context: { shipmentReference: shipmentSentinel },
        },
        durationMs: 20,
        timestamp,
      },
      {
        id: 'trace-step-2',
        stepNumber: 2,
        kind: 'locating_map',
        animationType: 'mapping',
        title: `Ubicando ${shipmentSentinel}`,
        detail: `Consulté la ruta de ${shipmentSentinel}.`,
        toolName: 'locateMapTool',
        input: { referenceOrContainer: shipmentSentinel },
        durationMs: 20,
        timestamp,
      },
      {
        id: 'trace-step-3',
        stepNumber: 3,
        kind: 'finding_container',
        animationType: 'finding',
        title: `Buscando ${containerSentinel}`,
        detail: `Busqué ${containerSentinel} con la consulta "${rawQuerySentinel}".`,
        toolName: 'searchCargoTool',
        input: {
          filters: [{ containerNumber: containerSentinel }],
          query: rawQuerySentinel,
        },
        durationMs: 20,
        timestamp,
      },
    ],
  });
  const serialized = JSON.stringify(trace);

  for (const sentinel of [
    shipmentSentinel,
    documentSentinel,
    containerSentinel,
    rawQuerySentinel,
  ]) {
    assert.doesNotMatch(serialized, new RegExp(sentinel, 'i'));
  }
  assert.deepEqual(
    trace.steps.map(({ id, title, detail }) => ({ id, title, detail })),
    [
      {
        id: 'trace-step-1',
        title: 'Leyendo requested information',
        detail:
          'Abrí el documento requested information para requested information.',
      },
      {
        id: 'trace-step-2',
        title: 'Ubicando requested information',
        detail: 'Consulté la ruta de requested information.',
      },
      {
        id: 'trace-step-3',
        title: 'Buscando requested information',
        detail:
          'Busqué requested information con la consulta "requested information".',
      },
    ],
  );
});

test('mapped tool summaries carry private input provenance into central sanitization', () => {
  const containerSentinel = 'MSCU-SENTINEL-1234567';
  const rawQuerySentinel = 'antique cobalt cabinet for confidential buyer';
  const vesselSentinel = 'VESSEL-SENTINEL-88';
  const locationSentinel = 'LOCATION-SENTINEL-77';
  const trace = createWorkTrace({
    durationMs: 2_000,
    executionSteps: [
      mapToolToTraceStep(
        'findContainerTool',
        { containerNumber: containerSentinel },
        {
          container: {
            current_vessel: vesselSentinel,
            current_location: locationSentinel,
          },
        },
        1,
      ),
      mapToolToTraceStep(
        'searchCargoTool',
        { query: rawQuerySentinel },
        { matchedCount: 2 },
        2,
      ),
    ],
  });
  const serialized = JSON.stringify(trace);

  assert.doesNotMatch(serialized, new RegExp(containerSentinel, 'i'));
  assert.doesNotMatch(serialized, new RegExp(rawQuerySentinel, 'i'));
  assert.doesNotMatch(serialized, new RegExp(vesselSentinel, 'i'));
  assert.doesNotMatch(serialized, new RegExp(locationSentinel, 'i'));
  assert.deepEqual(
    trace.steps.map(({ stepNumber, title }) => ({ stepNumber, title })),
    [
      { stepNumber: 1, title: 'Locating container' },
      { stepNumber: 2, title: 'Locating cargo' },
    ],
  );
});

test('source-bearing Work trace semantics use direct English logistics copy', () => {
  const steps = [
    mapToolToTraceStep('readDocumentTool', {}, { documents: [] }, 1),
    mapToolToTraceStep('getOperationDetailsTool', {}, { details: { documents: [] } }, 2),
    mapToolToTraceStep('reconcileShipmentDocumentsTool', {}, { discrepanciesCount: 0 }, 3),
  ];
  const copy = steps.map(({ title, detail }) => `${title} ${detail}`).join(' ');
  assert.match(copy, /Reading shipment document/);
  assert.match(copy, /Bill of Lading, Commercial Invoice, and Packing List/);
  assert.doesNotMatch(
    copy,
    /delegate|agent|subagent|Recon|tool|database|Supabase|JSON-render|catalog|schema|query|render|[áéíóúñ¿¡]/i,
  );
});

test('PDF sources are extracted only from supported settled tool results, deduplicated, and bounded', () => {
  const document = (index: number) => ({
    id: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
    file_name: `Supabase esquema ${index}.pdf`,
    type: index < 3 ? 'COMMERCIAL_INVOICE' : 'PACKING_LIST',
    mime_type: 'application/pdf',
    storage_bucket: 'private-documents',
    storage_path: `operations/private/document-${index}.pdf`,
  });
  const documents = Array.from({ length: 10 }, (_, index) => document(index + 1));
  const sources = extractWorkTraceSources('readDocumentTool', {
    documents: [documents[0], documents[0], ...documents.slice(1)],
  });

  assert.equal(sources.length, 8);
  assert.deepEqual(sources[0], {
    id: 'trace-source-1',
    title: 'Commercial Invoice',
    mimeType: 'application/pdf',
    contentUrl: '/api/documents/11111111-1111-4111-8111-000000000001/content',
  });
  assert.doesNotMatch(JSON.stringify(sources), /storage_bucket|storage_path|private-documents/);
  assert.deepEqual(
    extractWorkTraceSources('getOperationDetailsTool', {
      details: { documents: [document(2)] },
    }),
    [{ ...sources[0], title: 'Commercial Invoice', contentUrl: '/api/documents/11111111-1111-4111-8111-000000000002/content' }],
  );
  assert.deepEqual(extractWorkTraceSources('genericTool', { documents }), []);
  assert.deepEqual(
    extractWorkTraceSources('readDocumentTool', {
      documents: [
        { ...document(1), mime_type: 'text/plain' },
        { ...document(2), storage_path: null },
      ],
    }),
    [],
  );
  assert.equal(sources[1].title, 'Commercial Invoice 2');
  assert.equal(sources[2].title, 'Packing List');
  assert.doesNotMatch(
    sources.map(({ title }) => title).join(' '),
    /Supabase|schema|esquema|\.pdf|[áéíóúñ¿¡]/i,
  );
});

test('source titles are derived from validated logistics document types with a safe fallback', () => {
  const base = {
    id: '11111111-1111-4111-8111-111111111111',
    file_name: 'Recon herramienta Supabase esquema.pdf',
    mime_type: 'application/pdf',
    storage_bucket: 'private',
    storage_path: 'private/document.pdf',
  };
  const expected = [
    ['BILL_OF_LADING', 'Bill of Lading'],
    ['COMMERCIAL_INVOICE', 'Commercial Invoice'],
    ['PACKING_LIST', 'Packing List'],
    ['BOOKING_CONFIRMATION', 'Booking Confirmation'],
    ['PURCHASE_ORDER', 'Purchase Order'],
    ['ARRIVAL_NOTICE', 'Arrival Notice'],
    ['OTHER', 'Shipment document'],
    ['INVALID_TYPE', 'Shipment document'],
  ];
  for (const [type, title] of expected) {
    assert.equal(
      extractWorkTraceSources('readDocumentTool', {
        documents: [{ ...base, type }],
      })[0]?.title,
      title,
    );
  }
});

test('public source descriptors are optional, strict, and reject arbitrary or raw storage fields', () => {
  const trace = createWorkTrace({
    status: 'completed',
    durationMs: 1,
    executionSteps: [{
      id: 'internal', stepNumber: 1, kind: 'reading_document', status: 'completed',
      animationType: 'reading', title: 'Read', detail: 'Read a stored PDF.',
      durationMs: 1, timestamp,
      sources: [{
        id: 'trace-source-1', title: 'Invoice.pdf', mimeType: 'application/pdf',
        contentUrl: '/api/documents/11111111-1111-4111-8111-111111111111/content',
      }],
    }],
  });
  assert.equal(trace.steps[0].sources?.length, 1);
  const source = trace.steps[0].sources?.[0];
  for (const invalid of [
    { ...source, contentUrl: 'https://example.com/invoice.pdf' },
    { ...source, storage_path: 'private/invoice.pdf' },
    { ...source, rawSignedUrl: 'secret' },
  ]) {
    assert.equal(workTraceSchema.safeParse({ ...trace, steps: [{ ...trace.steps[0], sources: [invalid] }] }).success, false);
  }
});
