import assert from 'node:assert/strict';
import test from 'node:test';

import { mapToolToTraceStep } from './trace-step.js';
import { createWorkTrace } from './work-trace.js';

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
    durationMs: 4_500,
    steps: [
      {
        id: 'thinking-step',
        stepNumber: 1,
        kind: 'thinking',
        title: 'Entendiendo tu solicitud',
        detail: 'Organicé la consulta antes de revisar datos.',
      },
      {
        id: 'tool-step',
        stepNumber: 2,
        kind: 'querying_database',
        title: 'Consultando operación',
        detail: 'Revisé el estado confirmado de la operación.',
      },
    ],
  });
  assert.doesNotMatch(
    JSON.stringify(trace),
    /toolName|input|outputSummary|timestamp|animationType|OP-PRIVATE|provider/i,
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
        id: 'customs-step',
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
        id: 'alerts-step',
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
        id: 'customs-step',
        title: 'Revisando estatus de aduana',
        detail:
          'Verifiqué el semáforo fiscal y confirmé que la carga no requiere inspección.',
      },
      {
        id: 'alerts-step',
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
        id: 'safe-step-1',
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
        id: 'safe-step-2',
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
        id: 'safe-step-3',
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
        id: 'safe-step-1',
        title: 'Leyendo la información solicitada',
        detail:
          'Abrí el documento la información solicitada para la información solicitada.',
      },
      {
        id: 'safe-step-2',
        title: 'Ubicando la información solicitada',
        detail: 'Consulté la ruta de la información solicitada.',
      },
      {
        id: 'safe-step-3',
        title: 'Buscando la información solicitada',
        detail:
          'Busqué la información solicitada con la consulta "la información solicitada".',
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
      { stepNumber: 1, title: 'Container por barco' },
      { stepNumber: 2, title: 'Encontrando container' },
    ],
  );
});
