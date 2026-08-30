import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { StepResult } from '../../contracts/step-result.js';
import {
  containerStatuses,
  contextArtifactPropsSchema,
} from '../../contracts/ui.js';

interface RenderDemoToolOptions {
  onExecution?: () => void;
}

export function createRenderDemoTool(options: RenderDemoToolOptions = {}) {
  return createTool({
    id: 'render-json-demo',
    description:
      'Return the assistant answer through dynamic or demonstration json-render components.',
    inputSchema: z.object({
      assistantResponse: z
        .string()
        .min(1)
        .describe('Natural language explanation for the user summarizing query results.'),
      deliveryId: z.string().optional().describe('Shipment reference or container ID.'),
      from: z.string().optional().describe('Origin port/city (e.g. "Haiphong", "Shanghai").'),
      to: z.string().optional().describe('Destination port/city (e.g. "Manzanillo", "Veracruz").'),
      status: z.enum(containerStatuses).optional().describe('Current shipment progress status.'),
      transportType: z.enum(['Sea', 'Land']).optional().default('Sea'),
      issue: z.string().optional().describe('Optional issue description if an exception/alert exists.'),
      deliveryTime: z.string().optional().describe('ETA or estimated transit remaining time.'),
      contextArtifacts: z
        .array(contextArtifactPropsSchema)
        .max(3)
        .optional()
        .describe(
          'Optional high-value artifacts for the side pane. Omit for ordinary answers. Include only evidence-backed detail that would be useful to inspect separately and would otherwise overcrowd the main response.',
        ),
    }),
    execute: async ({
      assistantResponse,
      deliveryId,
      from,
      to,
      status,
      transportType,
      issue,
      deliveryTime,
      contextArtifacts,
    }): Promise<StepResult> => {
      options.onExecution?.();
      return {
        status: 'completed',
        summary: assistantResponse,
        factPatch: {
          assistantResponse,
          deliveryId,
          from,
          to,
          status,
          transportType,
          issue,
          deliveryTime,
          ...(contextArtifacts?.length ? { contextArtifacts } : {}),
        },
        evidence: [
          {
            id: 'json-render-ui',
            source: 'json-render:dynamic-components',
          },
        ],
      };
    },
  });
}
