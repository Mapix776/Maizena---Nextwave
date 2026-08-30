'use client'

import { defineRegistry } from '@json-render/react'
import { AssistantMessage } from '@/components/chat/assistant-message'
import { ContainerProgress } from '@/components/delivery/container-progress'
import { DeliveryCard } from '@/components/delivery/delivery-card'
import { DeliveryIssueCard } from '@/components/delivery/delivery-issue-card'
import { HumanDecisionCard } from '@/components/delivery/human-decision-card'
import { ShipmentDocumentsTimeline } from '@/components/delivery/shipment-documents-timeline'
import { BarChart } from '@/components/analytics/bar-chart'
import { CatalogChart } from '@/components/analytics/catalog-chart'
import { catalog } from './catalog'

export const { registry } = defineRegistry(catalog, {
  components: {
    AssistantMessage: ({ props, children }) => <AssistantMessage text={props.text} children={children} />,
    ContainerProgress: ({ props }) => <ContainerProgress currentStatus={props.currentStatus} />,
    DeliveryCard: ({ props, children }) => <DeliveryCard delivery={props} children={children} />,
    DeliveryIssueCard: ({ props }) => <DeliveryIssueCard delivery={props} />,
    HumanDecisionCard: ({ props }) => <HumanDecisionCard {...props} />,
    ShipmentDocumentsTimeline: ({ props }) => <ShipmentDocumentsTimeline {...props} />,
    BarChart: ({ props }) => <BarChart {...props} />,
    CatalogChart: ({ props }) => <CatalogChart {...props} />,
  },
})
