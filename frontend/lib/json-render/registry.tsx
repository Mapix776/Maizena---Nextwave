'use client'

import { defineRegistry } from '@json-render/react'
import { ContainerProgress } from '@/components/delivery/container-progress'
import { DeliveryCard } from '@/components/delivery/delivery-card'
import { DeliveryIssueCard } from '@/components/delivery/delivery-issue-card'
import { catalog } from './catalog'

export const { registry } = defineRegistry(catalog, {
  components: {
    ContainerProgress: ({ props }) => <ContainerProgress currentStatus={props.currentStatus} />,
    DeliveryCard: ({ props, children }) => <DeliveryCard delivery={props} children={children} />,
    DeliveryIssueCard: ({ props }) => <DeliveryIssueCard delivery={props} />,
  },
})
