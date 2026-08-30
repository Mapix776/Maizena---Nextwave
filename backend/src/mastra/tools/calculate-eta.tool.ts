import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { SupabaseReader } from '../../services/supabase-reader.js';

export interface CalculateEtaToolOptions {
  reader?: SupabaseReader;
}

export function createCalculateEtaTool(options: CalculateEtaToolOptions = {}) {
  const reader = options.reader ?? new SupabaseReader();
  return createTool({
    id: 'calculate-shipment-eta',
    description:
      'Calculate estimated time of arrival (ETA), delay analysis (ETA slip), remaining transit days, and port arrival predictions for a shipment or container.',
    inputSchema: z.object({
      referenceOrContainer: z
        .string()
        .min(1)
        .describe('Shipment reference (e.g. "OP-2026-101") or container number (e.g. "MSKU1234567").'),
    }),
    outputSchema: z.object({
      found: z.boolean(),
      etaAnalysis: z
        .object({
          currentEta: z.string().nullable(),
          originalEta: z.string().nullable(),
          actualArrival: z.string().nullable(),
          delayDays: z.number(),
          hasDelay: z.boolean(),
          humanReadableSummary: z.string(),
        })
        .nullable(),
    }),
    execute: async ({ referenceOrContainer }) => {
      let eta: string | null = null;
      let originalEta: string | null = null;
      let actualArrival: string | null = null;

      const container = await reader.getContainerByNumber(referenceOrContainer);
      if (container) {
        eta = container.eta;
        originalEta = container.original_eta;
        actualArrival = container.actual_arrival;
      } else {
        const op = await reader.getOperationByReferenceOrId(referenceOrContainer);
        if (op) {
          const containers = await reader.getContainersByOperation(op.id);
          const first = containers[0];
          eta = first?.eta ?? null;
          originalEta = first?.original_eta ?? null;
          actualArrival = first?.actual_arrival ?? null;
        }
      }

      if (!eta && !actualArrival) {
        return { found: false, etaAnalysis: null };
      }

      let delayDays = 0;
      let hasDelay = false;

      if (eta && originalEta) {
        const diffMs = new Date(eta).getTime() - new Date(originalEta).getTime();
        delayDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        hasDelay = delayDays > 0;
      }

      const summary = actualArrival
        ? `Shipment already arrived on ${new Date(actualArrival).toLocaleDateString()}.`
        : hasDelay
          ? `Delayed by ${delayDays} day(s). New estimated arrival is ${new Date(eta!).toLocaleDateString()}.`
          : `On schedule. Estimated arrival is ${new Date(eta!).toLocaleDateString()}.`;

      return {
        found: true,
        etaAnalysis: {
          currentEta: eta,
          originalEta,
          actualArrival,
          delayDays,
          hasDelay,
          humanReadableSummary: summary,
        },
      };
    },
  });
}
