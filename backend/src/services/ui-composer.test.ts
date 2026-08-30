import assert from 'node:assert/strict';
import test from 'node:test';

import type { StepResult } from '../contracts/step-result.js';
import { validateTracerSpec } from '../contracts/ui.js';
import { composeRunUi } from './ui-composer.js';

test('validated logistics facts compose into one ordered multi-component tree', () => {
  const result: StepResult = {
    status: 'completed',
    summary: 'Operation MDS-DEMO-RED-081 needs attention.',
    factPatch: {
      operationSummary: {
        operationId: 'operation-1',
        referenceCode: 'MDS-DEMO-RED-081',
        clientName: 'Muebles del Sur',
        status: 'CUSTOMS_CLEARANCE',
        tags: ['customs-red'],
        containers: [],
      },
      operationalAlerts: {
        title: 'Operational alerts',
        operationReference: 'MDS-DEMO-RED-081',
        alerts: [],
      },
      humanDecision: {
        decisionId: 'decision-1',
        title: 'Choose customs response',
        question: 'How should Ari proceed?',
        severity: 'critical',
        options: [{ id: 'notify', label: 'Notify client' }],
      },
      documentsTimeline: {
        title: 'Shipment documents',
        subtitle: 'Core import readiness',
        documents: [],
      },
      customsClearance: [
        {
          containerNumber: 'MSDU7000810',
          status: 'CUSTOMS_HOLD',
          customsLight: 'red',
          previoStatus: 'pending',
          pedimentoStatus: 'pending',
          alertIds: [],
          decisionIds: ['decision-1'],
        },
      ],
      etaRisks: [
        {
          containerNumber: 'MSDU7000830',
          originalEta: '2026-09-04T18:00:00Z',
          currentEta: '2026-09-13T18:00:00Z',
          slipDays: 9,
          severity: 'critical',
        },
      ],
      agentRuns: {
        title: 'Agent activity',
        operationReference: 'MDS-DEMO-RED-081',
        runs: [],
      },
      shipmentMilestones: [
        {
          containerNumber: 'MSDU7000810',
          originPort: 'Ho Chi Minh City, Vietnam',
          destinationPort: 'Manzanillo, Mexico',
          milestones: [
            { at: '2026-08-27T08:00:00Z', status: 'AT_PORT' },
          ],
        },
      ],
      operationsMetrics: {
        totalOperations: 11,
        totalContainers: 11,
        containersInTransit: 4,
        containersInCustoms: 3,
        delayedContainersCount: 2,
        criticalAlertsCount: 4,
        pendingDecisionsCount: 4,
        byStatus: [{ status: 'IN_TRANSIT', count: 4 }],
      },
    },
    evidence: [{ id: 'supabase-operation-details', source: 'supabase' }],
  };

  const spec = validateTracerSpec(composeRunUi(result));

  assert.deepEqual(spec.elements[spec.root]?.children, [
    'decision-card',
    'operation-summary',
    'operational-alerts',
    'customs-clearance-1',
    'eta-risk-1',
    'shipment-documents',
    'agent-runs',
    'shipment-milestones-1',
    'operations-metrics',
  ]);
  assert.deepEqual(
    spec.elements[spec.root]?.children.map((id) => spec.elements[id]?.type),
    [
      'HumanDecisionCard',
      'OperationSummaryCard',
      'OperationalAlertList',
      'CustomsClearancePanel',
      'EtaRiskCard',
      'ShipmentDocumentsTimeline',
      'AgentRunTimeline',
      'ShipmentMilestoneTimeline',
      'OperationsMetricsCard',
    ],
  );
});

test('text-only results do not fabricate a shipment card', () => {
  const spec = validateTracerSpec(
    composeRunUi({
      status: 'completed',
      summary: 'No matching operation was found.',
      factPatch: { assistantResponse: 'No matching operation was found.' },
      evidence: [{ id: 'agent-response', source: 'ari-text' }],
    }),
  );

  assert.deepEqual(spec.elements[spec.root]?.children, []);
  assert.deepEqual(Object.values(spec.elements).map(({ type }) => type), [
    'AssistantMessage',
  ]);
});
