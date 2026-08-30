'use client'

import { defineRegistry } from '@json-render/react'
import { AssistantMessage } from '@/components/chat/assistant-message'
import { ContainerProgress } from '@/components/delivery/container-progress'
import { DeliveryCard } from '@/components/delivery/delivery-card'
import { DeliveryIssueCard } from '@/components/delivery/delivery-issue-card'
import { HumanDecisionCard } from '@/components/delivery/human-decision-card'
import { ReconciliationFindings } from '@/components/delivery/reconciliation-findings'
import { ShipmentDocumentsTimeline } from '@/components/delivery/shipment-documents-timeline'
import { BarChart } from '@/components/analytics/bar-chart'
import { CatalogChart } from '@/components/analytics/catalog-chart'
import { InteractiveChart } from '@/components/analytics/interactive-chart'
import { AgentRunTimeline } from '@/components/logistics/agent-run-timeline'
import { CustomsClearancePanel } from '@/components/logistics/customs-clearance-panel'
import { DocumentDetailsCard } from '@/components/logistics/document-details-card'
import { EtaRiskCard } from '@/components/logistics/eta-risk-card'
import { OperationalAlertList } from '@/components/logistics/operational-alert-list'
import { OperationsMetricsCard } from '@/components/logistics/operations-metrics-card'
import { OperationSummaryCard } from '@/components/logistics/operation-summary-card'
import { ShipmentMilestoneTimeline } from '@/components/logistics/shipment-milestone-timeline'
import { catalog } from './catalog'

export const { registry } = defineRegistry(catalog, {
  components: {
    AssistantMessage: ({ props, children }) => <AssistantMessage text={props.text} children={children} />,
    ContainerProgress: ({ props }) => <ContainerProgress currentStatus={props.currentStatus} />,
    DeliveryCard: ({ props, children }) => <DeliveryCard delivery={props} children={children} />,
    DeliveryIssueCard: ({ props }) => <DeliveryIssueCard delivery={props} />,
    HumanDecisionCard: ({ props }) => <HumanDecisionCard {...props} />,
    OperationSummaryCard: ({ props }) => <OperationSummaryCard {...props} />,
    OperationalAlertList: ({ props }) => <OperationalAlertList {...props} />,
    DocumentDetailsCard: ({ props }) => <DocumentDetailsCard {...props} />,
    CustomsClearancePanel: ({ props }) => <CustomsClearancePanel {...props} />,
    EtaRiskCard: ({ props }) => <EtaRiskCard {...props} />,
    AgentRunTimeline: ({ props }) => <AgentRunTimeline {...props} />,
    ShipmentMilestoneTimeline: ({ props }) => <ShipmentMilestoneTimeline {...props} />,
    OperationsMetricsCard: ({ props }) => <OperationsMetricsCard {...props} />,
    ReconciliationFindings: ({ props }) => <ReconciliationFindings {...props} />,
    ShipmentDocumentsTimeline: ({ props }) => <ShipmentDocumentsTimeline {...props} />,
    BarChart: ({ props }) => <BarChart {...props} />,
    CatalogChart: ({ props }) => <CatalogChart {...props} />,
    InteractiveChart: ({ props }) => <InteractiveChart {...props} />,
  },
})
