'use client'

import { defineRegistry } from '@json-render/react'
import { AssistantMessage } from '@/components/chat/assistant-message'
import { ContainerProgress } from '@/components/delivery/container-progress'
import { DeliveryCard } from '@/components/delivery/delivery-card'
import { DeliveryIssueCard } from '@/components/delivery/delivery-issue-card'
import { catalog } from './catalog'

export const { registry } = defineRegistry(catalog, {
  components: {
    AssistantMessage: ({ props, children }) => <AssistantMessage text={props.text} children={children} />,
    ContainerProgress: ({ props }) => <ContainerProgress currentStatus={props.currentStatus} />,
    DeliveryCard: ({ props, children }) => <DeliveryCard delivery={props} children={children} />,
    DeliveryIssueCard: ({ props }) => <DeliveryIssueCard delivery={props} />,
  },
})
