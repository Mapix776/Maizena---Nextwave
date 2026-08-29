import type { Spec } from '@json-render/core'

const delivery = (id: string, status: 'Booking Confirmed' | 'In Transit' | 'Arrived at Port' | 'Customs' | 'Delivered', transportType: 'Sea' | 'Land' = 'Sea') => ({
  id, from: 'Shanghai', to: 'Cartagena', transportType, status, createdAt: '2026-08-29T10:30:00Z', deliveryTime: status === 'Delivered' ? 'Delivered' : '18 days',
})

export const catalogShowcase: Array<{ name: string; description: string; spec: Spec }> = [
  { name: 'AssistantMessage', description: 'Mensajes conversacionales con contenido anidado.', spec: { root: 'assistant', elements: { assistant: { type: 'AssistantMessage', props: { text: 'He encontrado tres envíos que necesitan atención.' }, children: [] } } } },
  ...(['Booking Confirmed', 'In Transit', 'Arrived at Port', 'Customs', 'Delivered'] as const).map((status) => ({ name: `ContainerProgress · ${status}`, description: 'Todas las etapas posibles del progreso de un contenedor.', spec: { root: `progress-${status}`, elements: { [`progress-${status}`]: { type: 'ContainerProgress', props: { currentStatus: status }, children: [] } } } })),
  ...(['Sea', 'Land'] as const).map((transportType) => ({ name: `DeliveryCard · ${transportType}`, description: 'Variantes de transporte marítimo y terrestre.', spec: { root: `delivery-${transportType}`, elements: { [`delivery-${transportType}`]: { type: 'DeliveryCard', props: delivery(`SHIP-${transportType}`, 'In Transit', transportType), children: [] } } } })),
  { name: 'DeliveryIssueCard', description: 'Tarjeta de entrega con incidencia operativa.', spec: { root: 'issue', elements: { issue: { type: 'DeliveryIssueCard', props: { ...delivery('SHIP-ISSUE', 'Customs'), issue: 'Customs clearance delayed' }, children: [] } } } },
  { name: 'ShipmentDocumentsTimeline', description: 'Estados completed, in_progress, pending y missing.', spec: { root: 'documents', elements: { documents: { type: 'ShipmentDocumentsTimeline', props: { title: 'Shipment documents', subtitle: 'Document readiness by milestone', documents: [
    { id: 'purchase-order', title: 'Purchase order', description: 'Commercial order approved.', status: 'completed', date: 'Aug 21, 2026' },
    { id: 'booking-confirmation', title: 'Booking confirmation', description: 'Carrier space is confirmed.', status: 'in_progress', date: 'Aug 24, 2026' },
    { id: 'bill-of-lading', title: 'Bill of lading', description: 'Awaiting carrier upload.', status: 'pending' },
    { id: 'invoice', title: 'Commercial invoice', description: 'Required before customs review.', status: 'missing' },
  ] }, children: [] } } } },
  ...([['vertical', true, true], ['horizontal', true, false], ['vertical', false, true], ['horizontal', false, false]] as const).map(([orientation, showValues, showGrid], index) => ({ name: `BarChart · ${orientation} · ${showValues ? 'values' : 'clean'}`, description: 'Variantes de orientación, valores y cuadrícula.', spec: { root: `chart-${index}`, elements: { [`chart-${index}`]: { type: 'BarChart', props: { title: 'Shipments by status', description: 'Current shipment distribution', data: [{ label: 'Delivered', value: 42 }, { label: 'In transit', value: 28 }, { label: 'Customs', value: 9 }, { label: 'Delayed', value: 6 }], orientation, showValues, showGrid, height: orientation === 'horizontal' ? 260 : 300 }, children: [] } } } })),
]
