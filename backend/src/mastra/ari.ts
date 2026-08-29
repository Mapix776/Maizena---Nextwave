import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { StepResult } from '../contracts/step-result.js';
import { HELLO_STEP_RESULT } from '../fixtures/hello.js';
import { DeterministicHelloModel } from './models.js';

interface AriOptions {
  onHelloToolExecution?: () => void;
}

export function createAriAgent(options: AriOptions = {}) {
  const helloTool = createTool({
    id: 'deterministic-hello',
    description: 'Return the Nauta engine tracer hello fixture.',
    inputSchema: z.object({}),
    execute: async () => {
      options.onHelloToolExecution?.();
      return HELLO_STEP_RESULT;
    },
  });

  return new Agent({
    id: 'ari',
    name: 'Ari',
    instructions: 'Call helloTool exactly once and finish.',
    model: new DeterministicHelloModel(),
    tools: { helloTool },
  });
}

export async function executeAriStep(agent = createAriAgent()): Promise<StepResult> {
  const response = await agent.generate('Run the deterministic engine tracer.', {
    maxSteps: 2,
  });
  const helloResult = response.toolResults.find(
    ({ payload }) => payload.toolName === 'helloTool',
  );

  if (!helloResult) {
    throw new Error('Ari completed without invoking helloTool.');
  }

  // The agent boundary intentionally returns unknown tool data. RunCoordinator
  // is the only layer allowed to validate the StepResult before state mutation.
  return helloResult.payload.result as StepResult;
}
