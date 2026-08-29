import type { ShipmentDocumentsTimelineProps } from '@/components/delivery/shipment-documents-timeline'

export const shipmentDocumentsTimelineExample: ShipmentDocumentsTimelineProps = {
  title: 'Shipment Documents',
  subtitle: 'Document workflow',
  documents: [
    { id: 'purchase-order', title: 'Purchase Order', description: 'Purchase order created', status: 'completed', date: 'Aug 24, 2026', documentUrl: '/documents/purchase-order.pdf' },
    { id: 'booking-confirmation', title: 'Booking Confirmation', description: 'Shipment booking confirmed', status: 'completed', date: 'Aug 25, 2026', documentUrl: '/documents/booking.pdf' },
    { id: 'bill-of-lading', title: 'Bill of Lading', description: 'Bill of lading generated', status: 'in_progress', date: 'Aug 27, 2026' },
    { id: 'invoice', title: 'Invoice', description: 'Commercial invoice generated', status: 'pending' },
    { id: 'packing-list', title: 'Packing List', description: 'Packing list generated', status: 'pending' },
    { id: 'arrival-notice', title: 'Arrival Notice', description: 'Arrival notice received', status: 'pending' },
  ],
}
