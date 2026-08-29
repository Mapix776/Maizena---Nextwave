import { Agent } from '@mastra/core/agent';
import type { LanguageModelV4 } from '@ai-sdk/provider';

import type { ChatMessage } from '../contracts/chat.js';
import type { StepResult } from '../contracts/step-result.js';
import { createProductionModel } from './models.js';
import {
  createSubagentRegistry,
  type SubagentRegistry,
} from './subagents/registry.js';
import {
  createToolRegistry,
  selectTools,
  type ToolRegistry,
} from './tools/registry.js';

export const ARI_SYSTEM_PROMPT = 'You are a helpful assistant.';

export const ARI_INSTRUCTIONS = `${ARI_SYSTEM_PROMPT}

Delegate requests to reconcile a Bill of Lading, Commercial Invoice, and
Packing List to reconAgent.

For every user request, call renderDemoTool exactly once. Pass your helpful,
natural-language answer in assistantResponse. The tool returns that answer
inside a catalog-validated json-render tree together with hardcoded delivery
demo components. Do not write JSON yourself.`;

const ARI_TOOL_KEYS = ['renderDemoTool'] as const;

export interface AriOptions {
  model?: LanguageModelV4;
  onRenderToolExecution?: () => void;
  toolRegistry?: ToolRegistry;
  subagentRegistry?: SubagentRegistry;
}

export function createAriAgent(options: AriOptions = {}) {
  const model = options.model ?? createProductionModel();
  const toolRegistry =
    options.toolRegistry ??
    createToolRegistry({
      onRenderDemoExecution: options.onRenderToolExecution,
    });
  const subagentRegistry =
    options.subagentRegistry ??
    createSubagentRegistry({ model, toolRegistry });

  return new Agent({
    id: 'ari',
    name: 'Ari',
    instructions: ARI_INSTRUCTIONS,
    model,
    tools: selectTools(toolRegistry, ARI_TOOL_KEYS),
    agents: subagentRegistry,
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
  const response = await agent.generate(modelMessages, { maxSteps: 6 });
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
