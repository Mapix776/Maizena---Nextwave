import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import type { LanguageModelV4 } from '@ai-sdk/provider';
import { z } from 'zod';

import type { ChatMessage } from '../contracts/chat.js';
import type { StepResult } from '../contracts/step-result.js';
import { createProductionModel } from './models.js';

export const ARI_SYSTEM_PROMPT = 'You are a helpful assistant.';

export const ARI_INSTRUCTIONS = `${ARI_SYSTEM_PROMPT}

For every user request, call renderDemoTool exactly once. Pass your helpful,
natural-language answer in assistantResponse. The tool returns that answer
inside a catalog-validated json-render tree together with hardcoded delivery
demo components. Do not write JSON yourself.`;

interface AriOptions {
  model?: LanguageModelV4;
  onRenderToolExecution?: () => void;
}

export function createAriAgent(options: AriOptions = {}) {
  const renderDemoTool = createTool({
    id: 'render-json-demo',
    description:
      'Return the assistant answer through the fixed json-render demonstration components.',
    inputSchema: z.object({
      assistantResponse: z.string().min(1),
    }),
    execute: async ({ assistantResponse }): Promise<StepResult> => {
      options.onRenderToolExecution?.();
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

  return new Agent({
    id: 'ari',
    name: 'Ari',
    instructions: ARI_INSTRUCTIONS,
    model: options.model ?? createProductionModel(),
    tools: { renderDemoTool },
  });
}

export async function executeAriStep(
  messages: ChatMessage[] = [
    { role: 'user', content: 'Run the json-render demo.' },
  ],
  agent = createAriAgent(),
): Promise<StepResult> {
  const modelMessages = messages.map((message) =>
    message.role === 'user'
      ? { role: 'user' as const, content: message.content }
      : { role: 'assistant' as const, content: message.content },
  );
  const response = await agent.generate(modelMessages, { maxSteps: 2 });
  const renderResult = response.toolResults.find(
    ({ payload }) => payload.toolName === 'renderDemoTool',
  );

  if (!renderResult) {
    throw new Error('Ari completed without invoking renderDemoTool.');
  }

  // The agent boundary intentionally returns unknown tool data. RunCoordinator
  // is the only layer allowed to validate the StepResult before state mutation.
  return renderResult.payload.result as StepResult;
}
