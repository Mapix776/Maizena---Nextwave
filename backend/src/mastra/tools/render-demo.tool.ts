import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { StepResult } from '../../contracts/step-result.js';

interface RenderDemoToolOptions {
  onExecution?: () => void;
}

export function createRenderDemoTool(options: RenderDemoToolOptions = {}) {
  return createTool({
    id: 'render-json-demo',
    description:
      'Return the assistant answer through the fixed json-render demonstration components.',
    inputSchema: z.object({
      assistantResponse: z.string().min(1),
    }),
    execute: async ({ assistantResponse }): Promise<StepResult> => {
      options.onExecution?.();
      return {
        status: 'completed',
        summary: assistantResponse,
        factPatch: { assistantResponse },
        evidence: [
          {
            id: 'hardcoded-ui-demo',
            source: 'json-render:hardcoded-components',
          },
        ],
      };
    },
  });
}
