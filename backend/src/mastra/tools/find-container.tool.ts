import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { SupabaseReader } from '../../services/supabase-reader.js';

export interface FindContainerToolOptions {
  reader?: SupabaseReader;
}

export function createFindContainerTool(options: FindContainerToolOptions = {}) {
  const reader = options.reader ?? new SupabaseReader();
  return createTool({
    id: 'find-container',
    description:
      'Locate and retrieve container tracking information, current port or ocean coordinates, vessel, and customs hold status by container number or keyword.',
    inputSchema: z.object({
      containerQuery: z
        .string()
        .min(1)
        .describe('Container ISO number (e.g. "MSKU1234567", "CMAU9876543") or search term.'),
    }),
    outputSchema: z.object({
      found: z.boolean(),
      container: z.any().nullable(),
    }),
    execute: async ({ containerQuery }) => {
      const container = await reader.getContainerByNumber(containerQuery);
      if (container) {
        return { found: true, container };
      }

      // Universal fallback search for container
      const searchRes = await reader.universalSearch(containerQuery);
      const match = searchRes.containers[0] ?? null;
      return {
        found: match !== null,
        container: match,
      };
    },
  });
}
