import type { JsonRenderSpec } from './catalog'

export const barChartExample: JsonRenderSpec = {
  root: 'shipment-status-chart',
  elements: {
    'shipment-status-chart': {
      type: 'BarChart',
      props: {
        title: 'Shipments by Status',
        description: 'Current shipment distribution',
        data: [
          { label: 'Delivered', value: 42 },
          { label: 'In Transit', value: 28 },
          { label: 'At Port', value: 15 },
          { label: 'Customs', value: 9 },
          { label: 'Delayed', value: 6 },
        ],
        xAxisLabel: 'Status',
        yAxisLabel: 'Shipments',
        showValues: true,
        showGrid: true,
        orientation: 'vertical',
        height: 320,
      },
      children: [],
    },
  },
}
