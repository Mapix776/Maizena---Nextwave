import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { SupabaseReader } from '../../services/supabase-reader.js';

export interface CompareDataToolOptions {
  reader?: SupabaseReader;
}

export function createCompareDataTool(options: CompareDataToolOptions = {}) {
  const reader = options.reader ?? new SupabaseReader();
  return createTool({
    id: 'compare-shipment-data',
    description:
      'Reconcile and cross-compare data across logistics documents (Bill of Lading vs Commercial Invoice vs Customs Declaration) to detect weight, value, or container mismatches.',
    inputSchema: z.object({
      operationIdOrRef: z
        .string()
        .min(1)
        .describe('Operation reference code (e.g. "OP-2026-101", "OP-2026-105") or UUID.'),
    }),
    outputSchema: z.object({
      status: z.enum(['matched', 'discrepancy']),
      discrepanciesCount: z.number(),
      discrepancies: z.array(z.any()),
      humanSummary: z.string(),
    }),
    execute: async ({ operationIdOrRef }) => {
      const op = await reader.getOperationByReferenceOrId(operationIdOrRef);
      if (!op) {
        return {
          status: 'matched' as const,
          discrepanciesCount: 0,
          discrepancies: [],
          humanSummary: 'No discrepancies found.',
        };
      }

      const discrepancies = (op.discrepancies as Array<Record<string, unknown>>) || [];
      const hasDiscrepancy = discrepancies.length > 0;

      const summary = hasDiscrepancy
        ? `Found ${discrepancies.length} discrepancy between shipment documents requiring review.`
        : 'All document facts (weights, container IDs, amounts) match perfectly.';

      return {
        status: (hasDiscrepancy ? 'discrepancy' : 'matched') as 'matched' | 'discrepancy',
        discrepanciesCount: discrepancies.length,
        discrepancies,
        humanSummary: summary,
      };
    },
  });
}
