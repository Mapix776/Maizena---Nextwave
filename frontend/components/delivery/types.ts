export const containerStatuses = [
  'Booking Confirmed',
  'In Transit',
  'Arrived at Port',
  'Customs',
  'Delivered',
] as const

export type ContainerStatus = (typeof containerStatuses)[number]
export type TransportType = 'Sea' | 'Land'

export interface Delivery {
  id: string
  from: string
  to: string
  transportType: TransportType
  status: ContainerStatus
  createdAt: string
  deliveryTime: string
}

export interface DeliveryIssue extends Delivery {
  issue: string
}

export function formatDeliveryDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
}

export function statusIndex(status: ContainerStatus) {
  return containerStatuses.indexOf(status)
}

export function statusTone(status: ContainerStatus) {
  if (status === 'Delivered') return 'text-emerald-600'
  if (status === 'Customs') return 'text-amber-600'
  if (status === 'In Transit') return 'text-blue-600'
  return 'text-muted-foreground'
}
