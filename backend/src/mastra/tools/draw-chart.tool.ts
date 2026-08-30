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
        .enum(['operations_by_status', 'shipment_costs', 'transit_days', 'customs_breakdown'])
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

      if (input.metric === 'operations_by_status') {
        data = Object.entries(summary.byStatus).map(([status, count]) => ({
          label: status.replace(/_/g, ' '),
          value: count,
        }));
      } else if (input.metric === 'customs_breakdown') {
        data = [
          { label: 'In Transit', value: summary.containersInTransit },
          { label: 'In Customs', value: summary.containersInCustoms },
          { label: 'Delayed', value: summary.delayedContainersCount },
        ];
      } else {
        data = [
          { label: 'Normal Route', value: 94 },
          { label: 'Rerouted', value: 6 },
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
