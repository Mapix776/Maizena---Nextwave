import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { OperationSummaryCard } from './operation-summary-card'
import { OperationalAlertList } from './operational-alert-list'
import { DocumentDetailsCard } from './document-details-card'
import { CustomsClearancePanel } from './customs-clearance-panel'
import { EtaRiskCard } from './eta-risk-card'
import { AgentRunTimeline } from './agent-run-timeline'
import { ShipmentMilestoneTimeline } from './shipment-milestone-timeline'
import { OperationsMetricsCard } from './operations-metrics-card'
import { HumanDecisionCard } from '../delivery/human-decision-card'
import { ComparisonTable } from './comparison-table'
import { KpiGrid } from './kpi-grid'
import { StepProgressBar } from './step-progress-bar'

test('OperationSummaryCard renders the canonical operation and container route', () => {
  const html = renderToStaticMarkup(
    <OperationSummaryCard
      operationId="operation-1"
      referenceCode="MDS-DEMO-RED-081"
      clientName="Muebles del Sur"
      status="CUSTOMS_CLEARANCE"
      tags={['customs-red']}
      notes="Physical inspection requires attention."
      containers={[
        {
          id: 'container-1',
          containerNumber: 'MSDU7000810',
          status: 'CUSTOMS_HOLD',
          originPort: 'Ho Chi Minh City, Vietnam',
          destinationPort: 'Manzanillo, Mexico',
          currentLocation: 'Aduana Manzanillo',
          currentVessel: 'MSC AURORA',
          customsLight: 'red',
        },
      ]}
    />,
  )

  assert.match(html, /MDS-DEMO-RED-081/)
  assert.match(html, /Muebles del Sur/)
  assert.match(html, /MSDU7000810/)
  assert.match(html, /Ho Chi Minh City, Vietnam/)
  assert.match(html, /Manzanillo, Mexico/)
  assert.match(html, /MSC AURORA/)
});

test('OperationalAlertList renders severity and acknowledgement state', () => {
  const html = renderToStaticMarkup(
    <OperationalAlertList
      title="Operational alerts"
      operationReference="MDS-DEMO-RED-081"
      alerts={[
        {
          id: 'event-1',
          severity: 'critical',
          category: 'customs_light_assigned',
          title: 'Red customs light',
          message: 'Physical inspection is required.',
          acknowledged: false,
          createdAt: '2026-08-29T20:00:00Z',
        },
      ]}
    />,
  )

  assert.match(html, /Red customs light/)
  assert.match(html, /Physical inspection is required/)
  assert.match(html, /Critical/)
  assert.match(html, /Unacknowledged/)
});

test('DocumentDetailsCard renders provenance and document parties', () => {
  const html = renderToStaticMarkup(
    <DocumentDetailsCard
      documentId="document-1"
      type="BILL_OF_LADING"
      fileName="03_Bill_of_Lading.pdf"
      reference="MSCUBL7749201MX"
      processingStatus="completed"
      confidence={1}
      fileSizeBytes={3337}
      mimeType="application/pdf"
      stored
      createdAt="2026-08-29T20:00:00Z"
      parties={[
        { role: 'CARRIER', name: 'Mediterranean Shipping Company' },
        { role: 'CONSIGNEE', name: 'Muebles del Sur', reference: 'MDS890512AB1' },
      ]}
    />,
  )

  assert.match(html, /Bill of lading/i)
  assert.match(html, /MSCUBL7749201MX/)
  assert.match(html, /100% confidence/)
  assert.match(html, /Mediterranean Shipping Company/)
  assert.match(html, /MDS890512AB1/)
  assert.match(html, /Stored/)
});

test('CustomsClearancePanel exposes red-light, previo, and pedimento state', () => {
  const html = renderToStaticMarkup(
    <CustomsClearancePanel
      containerNumber="MSDU7000810"
      status="CUSTOMS_HOLD"
      customsLight="red"
      currentLocation="Aduana Manzanillo"
      actualArrival="2026-08-27T08:00:00Z"
      previoStatus="pending"
      pedimentoStatus="pending"
      alertIds={['event-1']}
      decisionIds={['decision-1']}
    />,
  )

  assert.match(html, /MSDU7000810/)
  assert.match(html, /Red light/)
  assert.match(html, /Physical inspection required/)
  assert.match(html, /Previo/)
  assert.match(html, /Pedimento/)
  assert.match(html, /1 pending decision/)
});

test('EtaRiskCard renders the measured slip without presenting an inferred cost', () => {
  const html = renderToStaticMarkup(
    <EtaRiskCard
      containerNumber="MSDU7000830"
      originalEta="2026-09-04T18:00:00Z"
      currentEta="2026-09-13T18:00:00Z"
      slipDays={9}
      severity="critical"
      currentLocation="Busan, South Korea"
      currentVessel="MSC ORION"
    />,
  )

  assert.match(html, /9 days late/)
  assert.match(html, /MSDU7000830/)
  assert.match(html, /Busan, South Korea/)
  assert.match(html, /MSC ORION/)
  assert.doesNotMatch(html, /\$|cost exposure/i)
});

test('AgentRunTimeline renders the responsible agent, flow step, and wait state', () => {
  const html = renderToStaticMarkup(
    <AgentRunTimeline
      title="Agent activity"
      operationReference="MDS-DEMO-RED-081"
      runs={[
        {
          id: 'run-1',
          agentName: 'ARI',
          flowStep: 'customs_red_light_escalation',
          status: 'waiting_input',
          triggerEvent: 'customs_light_assigned',
          tokensUsed: 0,
          createdAt: '2026-08-29T20:00:00Z',
          updatedAt: '2026-08-29T20:00:00Z',
        },
      ]}
    />,
  )

  assert.match(html, /ARI/)
  assert.match(html, /customs red light escalation/)
  assert.match(html, /Waiting for input/)
  assert.match(html, /customs light assigned/)
});

test('ShipmentMilestoneTimeline renders observed route history without map coordinates', () => {
  const html = renderToStaticMarkup(
    <ShipmentMilestoneTimeline
      containerNumber="MSDU7000830"
      originPort="Cat Lai, Vietnam"
      destinationPort="Manzanillo, Mexico"
      milestones={[
        { at: '2026-08-18T12:00:00Z', status: 'IN_TRANSIT', location: 'South China Sea' },
        { at: '2026-08-25T06:00:00Z', status: 'AT_PORT', location: 'Busan, South Korea' },
      ]}
    />,
  )

  assert.match(html, /Cat Lai, Vietnam/)
  assert.match(html, /Manzanillo, Mexico/)
  assert.match(html, /South China Sea/)
  assert.match(html, /Busan, South Korea/)
  assert.match(html, /AT PORT/)
});

test('OperationsMetricsCard renders constrained totals and status counts', () => {
  const html = renderToStaticMarkup(
    <OperationsMetricsCard
      totalOperations={11}
      totalContainers={11}
      containersInTransit={4}
      containersInCustoms={3}
      delayedContainersCount={2}
      criticalAlertsCount={4}
      pendingDecisionsCount={4}
      byStatus={[
        { status: 'CUSTOMS_CLEARANCE', count: 3 },
        { status: 'IN_TRANSIT', count: 4 },
      ]}
    />,
  )

  assert.match(html, /11 operations/)
  assert.match(html, /4 in transit/)
  assert.match(html, /2 delayed/)
  assert.match(html, /4 critical alerts/)
  assert.match(html, /CUSTOMS CLEARANCE/)
  assert.match(html, /Review 4 pending decisions/)
});

test('HumanDecisionCard renders persisted decision context with sparse options', () => {
  const html = renderToStaticMarkup(
    <HumanDecisionCard
      decisionId="decision-1"
      operationId="operation-1"
      title="Choose customs response"
      description="Physical inspection may delay release."
      question="How should Ari proceed?"
      severity="critical"
      executionMode="requires_approval"
      createdAt="2026-08-29T20:00:00Z"
      options={[{ id: 'notify', label: 'Notify client' }]}
    />,
  )

  assert.match(html, /Physical inspection may delay release/)
  assert.match(html, /Requires approval/)
  assert.match(html, /Notify client/)
});

test('interactive backend catalog components render their validated content', () => {
  const kpiHtml = renderToStaticMarkup(
    <KpiGrid
      title="Network KPIs"
      metrics={[{ id: 'delays', label: 'Delayed', value: 2, unit: 'containers', severity: 'warning', trend: 'up' }]}
    />,
  )

  const pendingDecisionKpiHtml = renderToStaticMarkup(
    <KpiGrid
      title="Key Operations Metrics"
      metrics={[{ id: 'decisions', label: 'Decisions', value: 4, unit: 'pending', severity: 'critical' }]}
    />,
  )

  assert.match(pendingDecisionKpiHtml, /Review 4 pending decisions/)
  const comparisonHtml = renderToStaticMarkup(
    <ComparisonTable
      title="Bill of Lading vs Packing List"
      documentAName="Bill of Lading"
      documentBName="Packing List"
      severity="warning"
      fields={[{ field: 'weight', label: 'Weight', valueA: '18,050 kg', valueB: '18,200 kg', status: 'discrepancy', diff: '150 kg' }]}
    />,
  )
  const progressHtml = renderToStaticMarkup(
    <StepProgressBar
      title="Shipment itinerary"
      currentStepIndex={1}
      totalSteps={3}
      steps={[
        { id: 'origin', label: 'Origin', status: 'completed' },
        { id: 'transit', label: 'Transit', status: 'current', location: 'Pacific Ocean' },
        { id: 'destination', label: 'Destination', status: 'pending' },
      ]}
    />,
  )

  assert.match(kpiHtml, /Network KPIs/)
  assert.match(kpiHtml, /2/)
  assert.match(comparisonHtml, /150 kg/)
  assert.match(comparisonHtml, /Bill of Lading/)
  assert.match(progressHtml, /Step 2 of 3/)
  assert.match(progressHtml, /Pacific Ocean/)
})
