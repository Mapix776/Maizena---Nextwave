import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  OperationFullDetails,
  OperationsMetricsSummary,
} from './supabase-reader.js';
import {
  buildOperationCatalogFacts,
  buildOperationsMetricsCatalogFacts,
} from './logistics-ui-facts.js';

function operationBundle(): OperationFullDetails {
  return {
    operation: {
      id: '10200000-0000-4000-8000-000000000002',
      client_name: 'Muebles del Sur S.A. de C.V.',
      reference_code: 'MDS-DEMO-RED-081',
      status: 'CUSTOMS_CLEARANCE',
      canonical_data: {},
      discrepancies: [],
      tags: ['demo', 'customs-red'],
      notes: 'Active customs inspection case requiring a human decision.',
      created_at: '2026-08-29T23:12:12.987462+00:00',
      updated_at: '2026-08-29T23:36:05.013468+00:00',
    },
    containers: [
      {
        id: '20200000-0000-4000-8000-000000000002',
        operation_id: '10200000-0000-4000-8000-000000000002',
        container_number: 'MSDU7000810',
        container_type: '40HC',
        seal_number: 'MDS081SEAL',
        status: 'CUSTOMS_HOLD',
        origin_port: 'Ho Chi Minh City, Vietnam',
        destination_port: 'Manzanillo, Mexico',
        eta: '2026-08-26T12:00:00+00:00',
        original_eta: null,
        actual_arrival: '2026-08-27T08:00:00+00:00',
        current_location: 'Aduana Manzanillo',
        current_vessel: 'MSC AURORA',
        transit_history: [],
        weight_kg: 18120,
        declared_value_usd: 68500,
        customs_light: 'red',
        previo_completed_at: null,
        pedimento_number: null,
        created_at: '2026-08-29T23:14:46.381799+00:00',
        updated_at: '2026-08-29T23:14:46.381799+00:00',
      },
    ],
    documents: [],
    events: [],
    decisions: [],
    runs: [],
    parties: [],
    relationships: [],
  };
}

test('a 360 operation result becomes a strict operation summary fact', () => {
  const facts = buildOperationCatalogFacts(operationBundle());

  assert.deepEqual(facts.operationSummary, {
    operationId: '10200000-0000-4000-8000-000000000002',
    referenceCode: 'MDS-DEMO-RED-081',
    clientName: 'Muebles del Sur S.A. de C.V.',
    status: 'CUSTOMS_CLEARANCE',
    tags: ['demo', 'customs-red'],
    notes: 'Active customs inspection case requiring a human decision.',
    containers: [
      {
        id: '20200000-0000-4000-8000-000000000002',
        containerNumber: 'MSDU7000810',
        status: 'CUSTOMS_HOLD',
        originPort: 'Ho Chi Minh City, Vietnam',
        destinationPort: 'Manzanillo, Mexico',
        eta: '2026-08-26T12:00:00+00:00',
        actualArrival: '2026-08-27T08:00:00+00:00',
        currentLocation: 'Aduana Manzanillo',
        currentVessel: 'MSC AURORA',
        customsLight: 'red',
      },
    ],
  });
});

test('operation events become a normalized operational alert list', () => {
  const bundle = operationBundle();
  bundle.events = [
    {
      id: '40200000-0000-4000-8000-000000000002',
      run_id: null,
      operation_id: bundle.operation.id,
      severity: 'CRITICAL',
      category: 'customs_light_assigned',
      title: 'Red customs light - physical inspection required',
      message: 'Container MSDU7000810 requires a supervisor response.',
      details_json: null,
      acknowledged: false,
      acknowledged_by: null,
      acknowledged_at: null,
      created_at: '2026-08-29T23:14:48.24104+00:00',
    },
  ];

  assert.deepEqual(buildOperationCatalogFacts(bundle).operationalAlerts, {
    title: 'Operational alerts',
    operationReference: 'MDS-DEMO-RED-081',
    alerts: [
      {
        id: '40200000-0000-4000-8000-000000000002',
        severity: 'critical',
        category: 'customs_light_assigned',
        title: 'Red customs light - physical inspection required',
        message: 'Container MSDU7000810 requires a supervisor response.',
        acknowledged: false,
        createdAt: '2026-08-29T23:14:48.24104+00:00',
      },
    ],
  });
});

test('a persisted pending decision becomes a display-safe human decision fact', () => {
  const bundle = operationBundle();
  bundle.decisions = [
    {
      id: '50200000-0000-4000-8000-000000000002',
      run_id: '30200000-0000-4000-8000-000000000002',
      operation_id: bundle.operation.id,
      action_type: 'customs_red_light_escalation',
      title: 'Choose customs red-light response',
      description: 'Physical inspection may delay release.',
      severity: 'CRITICAL',
      execution_mode: 'REQUIRE_APPROVAL',
      default_action: { action: 'appoint_customs_broker' },
      options_json: [
        { id: 'broker', label: 'Assign broker and expedite inspection' },
        { id: 'client', label: 'Notify client and wait' },
      ],
      question: 'How should Ari handle the red-light inspection?',
      answer: null,
      status: 'PENDING',
      auto_execute_at: null,
      context_snapshot: null,
      user_response: null,
      created_at: '2026-08-29T23:14:48.846689+00:00',
      resolved_at: null,
    },
  ];

  assert.deepEqual(buildOperationCatalogFacts(bundle).humanDecision, {
    decisionId: '50200000-0000-4000-8000-000000000002',
    operationId: '10200000-0000-4000-8000-000000000002',
    title: 'Choose customs red-light response',
    description: 'Physical inspection may delay release.',
    question: 'How should Ari handle the red-light inspection?',
    severity: 'critical',
    executionMode: 'requires_approval',
    createdAt: '2026-08-29T23:14:48.846689+00:00',
    options: [
      { id: 'broker', label: 'Assign broker and expedite inspection' },
      { id: 'client', label: 'Notify client and wait' },
    ],
  });
});

test('operation documents become a core-readiness timeline with explicit missing items', () => {
  const bundle = operationBundle();
  bundle.documents = [
    {
      id: '98ae7784-22c3-49f3-aa35-839052a42b90',
      operation_id: bundle.operation.id,
      type: 'PURCHASE_ORDER',
      file_name: '01_Purchase_Order_PO-2026-0847.pdf',
      file_size: 3034,
      mime_type: 'application/pdf',
      document_reference: 'PO-2026-0847',
      storage_bucket: 'documents',
      storage_path: 'operations/example/purchase-orders/po.pdf',
      raw_md: '',
      extracted_json: null,
      confidence_score: 1,
      processing_status: 'COMPLETED',
      error_message: null,
      created_at: '2026-08-29T21:33:56.370134+00:00',
    },
  ];

  assert.deepEqual(buildOperationCatalogFacts(bundle).documentsTimeline, {
    title: 'Shipment documents',
    subtitle: 'MDS-DEMO-RED-081 · core import readiness',
    documents: [
      {
        id: 'purchase-order',
        title: 'Purchase order',
        description: 'PO-2026-0847 · 01_Purchase_Order_PO-2026-0847.pdf',
        status: 'completed',
        date: '2026-08-29T21:33:56.370134+00:00',
      },
      {
        id: 'booking-confirmation',
        title: 'Booking confirmation',
        description: 'Required for the core import workflow.',
        status: 'missing',
      },
      {
        id: 'bill-of-lading',
        title: 'Bill of lading',
        description: 'Required for the core import workflow.',
        status: 'missing',
      },
      {
        id: 'commercial-invoice',
        title: 'Commercial invoice',
        description: 'Required for the core import workflow.',
        status: 'missing',
      },
      {
        id: 'packing-list',
        title: 'Packing list',
        description: 'Required for the core import workflow.',
        status: 'missing',
      },
    ],
  });
});

test('document details retain confidence, storage presence, and associated parties', () => {
  const bundle = operationBundle();
  bundle.documents = [
    {
      id: 'af454e48-b065-4f93-83f7-ad98e385902f',
      operation_id: bundle.operation.id,
      type: 'BILL_OF_LADING',
      file_name: '03_Bill_of_Lading_MSCUBL7749201MX.pdf',
      file_size: 3337,
      mime_type: 'application/pdf',
      document_reference: 'MSCUBL7749201MX',
      storage_bucket: 'documents',
      storage_path: 'operations/example/bills-of-lading/bl.pdf',
      raw_md: '',
      extracted_json: null,
      confidence_score: 1,
      processing_status: 'COMPLETED',
      error_message: null,
      created_at: '2026-08-29T21:33:57.44531+00:00',
    },
  ];
  bundle.parties = [
    {
      id: 'party-1',
      document_id: 'af454e48-b065-4f93-83f7-ad98e385902f',
      party_role: 'CARRIER',
      party_name: 'Mediterranean Shipping Company (MSC)',
      party_reference: null,
      details_json: {},
      created_at: '2026-08-29T21:43:12.603994+00:00',
    },
    {
      id: 'party-2',
      document_id: 'af454e48-b065-4f93-83f7-ad98e385902f',
      party_role: 'CONSIGNEE',
      party_name: 'Muebles del Sur S.A. de C.V.',
      party_reference: 'MDS890512AB1',
      details_json: {},
      created_at: '2026-08-29T21:43:12.603994+00:00',
    },
  ];

  assert.deepEqual(buildOperationCatalogFacts(bundle).documentDetails, [
    {
      documentId: 'af454e48-b065-4f93-83f7-ad98e385902f',
      type: 'BILL_OF_LADING',
      fileName: '03_Bill_of_Lading_MSCUBL7749201MX.pdf',
      reference: 'MSCUBL7749201MX',
      processingStatus: 'completed',
      confidence: 1,
      fileSizeBytes: 3337,
      mimeType: 'application/pdf',
      stored: true,
      createdAt: '2026-08-29T21:33:57.44531+00:00',
      parties: [
        {
          role: 'CARRIER',
          name: 'Mediterranean Shipping Company (MSC)',
        },
        {
          role: 'CONSIGNEE',
          name: 'Muebles del Sur S.A. de C.V.',
          reference: 'MDS890512AB1',
        },
      ],
    },
  ]);
});

test('customs-state containers become an explicit clearance panel', () => {
  assert.deepEqual(buildOperationCatalogFacts(operationBundle()).customsClearance, [
    {
      containerNumber: 'MSDU7000810',
      status: 'CUSTOMS_HOLD',
      customsLight: 'red',
      currentLocation: 'Aduana Manzanillo',
      actualArrival: '2026-08-27T08:00:00+00:00',
      previoStatus: 'pending',
      pedimentoStatus: 'pending',
      alertIds: [],
      decisionIds: [],
    },
  ]);
});

test('an ETA slip becomes a deterministic risk card without inventing costs', () => {
  const bundle = operationBundle();
  const container = bundle.containers[0]!;
  container.container_number = 'MSDU7000830';
  container.original_eta = '2026-09-04T18:00:00+00:00';
  container.eta = '2026-09-13T18:00:00+00:00';
  container.current_location = 'Busan, South Korea';
  container.current_vessel = 'MSC ORION';

  assert.deepEqual(buildOperationCatalogFacts(bundle).etaRisks, [
    {
      containerNumber: 'MSDU7000830',
      originalEta: '2026-09-04T18:00:00+00:00',
      currentEta: '2026-09-13T18:00:00+00:00',
      slipDays: 9,
      severity: 'critical',
      currentLocation: 'Busan, South Korea',
      currentVessel: 'MSC ORION',
    },
  ]);
});

test('persisted agent runs become an auditable activity timeline', () => {
  const bundle = operationBundle();
  bundle.runs = [
    {
      id: '30200000-0000-4000-8000-000000000002',
      operation_id: bundle.operation.id,
      agent_name: 'ARI',
      flow_step: 'customs_red_light_escalation',
      status: 'WAITING_INPUT',
      context_json: {},
      trigger_event: 'customs_light_assigned',
      trigger_document_id: null,
      tokens_used: 0,
      error_message: null,
      created_at: '2026-08-29T23:14:47.42057+00:00',
      updated_at: '2026-08-29T23:14:47.42057+00:00',
    },
  ];

  assert.deepEqual(buildOperationCatalogFacts(bundle).agentRuns, {
    title: 'Agent activity',
    operationReference: 'MDS-DEMO-RED-081',
    runs: [
      {
        id: '30200000-0000-4000-8000-000000000002',
        agentName: 'ARI',
        flowStep: 'customs_red_light_escalation',
        status: 'waiting_input',
        triggerEvent: 'customs_light_assigned',
        tokensUsed: 0,
        createdAt: '2026-08-29T23:14:47.42057+00:00',
        updatedAt: '2026-08-29T23:14:47.42057+00:00',
      },
    ],
  });
});

test('typed transit history becomes a shipment milestone timeline', () => {
  const bundle = operationBundle();
  bundle.containers[0]!.transit_history = [
    {
      at: '2026-08-18T12:00:00Z',
      status: 'IN_TRANSIT',
      location: 'South China Sea',
    },
    {
      at: '2026-08-25T06:00:00Z',
      status: 'AT_PORT',
      location: 'Busan, South Korea',
    },
  ];

  assert.deepEqual(buildOperationCatalogFacts(bundle).shipmentMilestones, [
    {
      containerNumber: 'MSDU7000810',
      originPort: 'Ho Chi Minh City, Vietnam',
      destinationPort: 'Manzanillo, Mexico',
      milestones: [
        {
          at: '2026-08-18T12:00:00Z',
          status: 'IN_TRANSIT',
          location: 'South China Sea',
        },
        {
          at: '2026-08-25T06:00:00Z',
          status: 'AT_PORT',
          location: 'Busan, South Korea',
        },
      ],
    },
  ]);
});

test('global metrics become a constrained operational metrics component', () => {
  const summary: OperationsMetricsSummary = {
    totalOperations: 11,
    byStatus: { IN_TRANSIT: 4, DELIVERED: 1, CUSTOMS_CLEARANCE: 3 },
    totalContainers: 11,
    containersInTransit: 4,
    containersInCustoms: 3,
    delayedContainersCount: 2,
    criticalAlertsCount: 4,
    pendingDecisionsCount: 4,
  };

  assert.deepEqual(buildOperationsMetricsCatalogFacts(summary), {
    totalOperations: 11,
    totalContainers: 11,
    containersInTransit: 4,
    containersInCustoms: 3,
    delayedContainersCount: 2,
    criticalAlertsCount: 4,
    pendingDecisionsCount: 4,
    byStatus: [
      { status: 'CUSTOMS_CLEARANCE', count: 3 },
      { status: 'DELIVERED', count: 1 },
      { status: 'IN_TRANSIT', count: 4 },
    ],
  });
});
