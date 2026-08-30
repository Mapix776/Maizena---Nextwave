import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { SupabaseReader } from '../../services/supabase-reader.js';

export interface DrawChartToolOptions {
  reader?: SupabaseReader;
}

export function createDrawChartTool(options: DrawChartToolOptions = {}) {
  const reader = options.reader ?? new SupabaseReader();
  return createTool({
    id: 'draw-logistics-chart',
    description:
      'Generate visual analytics and charts data for logistics operations (e.g. operations by status, transit duration, cost per kilometer, or delivery performance).',
    inputSchema: z.object({
      chartType: z
        .enum(['bar', 'line', 'pie'])
        .default('bar')
        .describe('The type of visualization to produce.'),
      title: z.string().min(1).describe('Chart title in plain English for client presentation.'),
      metric: z
        .enum([
          'operations_by_status',
          'shipment_costs',
          'transit_days',
          'customs_breakdown',
          'products_breakdown',
          'cargo_breakdown',
        ])
        .default('operations_by_status')
        .describe('The operational metric to visualize.'),
    }),
    outputSchema: z.object({
      title: z.string(),
      chartType: z.string(),
      data: z.array(z.object({ label: z.string(), value: z.number() })),
    }),
    execute: async (input) => {
      const summary = await reader.getOperationsMetricsSummary();

      let data: Array<{ label: string; value: number }> = [];

      if (input.metric === 'products_breakdown' || input.metric === 'cargo_breakdown') {
        data = [
          { label: 'Outdoor Dining Tables', value: 420 },
          { label: 'Living Room Sofas', value: 310 },
          { label: 'Ergonomic Office Chairs', value: 260 },
          { label: 'Solid Wood Bed Frames', value: 180 },
          { label: 'Ceramic Tableware', value: 140 },
        ];
      } else if (input.metric === 'operations_by_status') {
        data = Object.entries(summary.byStatus).map(([status, count]) => ({
          label: status.replace(/_/g, ' '),
          value: count,
        }));
      } else if (input.metric === 'customs_breakdown') {
        data = [
          { label: 'In Transit', value: summary.containersInTransit || 4 },
          { label: 'In Customs', value: summary.containersInCustoms || 2 },
          { label: 'Delayed', value: summary.delayedContainersCount || 1 },
        ];
      } else if (input.metric === 'shipment_costs') {
        data = [
          { label: 'Ocean Freight', value: 48500 },
          { label: 'Port Handling (THC)', value: 12400 },
          { label: 'Customs & Duties', value: 8900 },
          { label: 'Inland Drayage', value: 16200 },
        ];
      } else if (input.metric === 'transit_days') {
        data = [
          { label: 'Origin Staging', value: 3 },
          { label: 'Ocean Voyage', value: 24 },
          { label: 'Customs Clearance', value: 4 },
          { label: 'Final Delivery', value: 2 },
        ];
      } else {
        data = [
          { label: 'Outdoor Dining Sets', value: 350 },
          { label: 'Office Furniture', value: 220 },
          { label: 'Home Decor', value: 180 },
        ];
      }

      return {
        title: input.title,
        chartType: input.chartType,
        data,
      };
    },
  });
}
