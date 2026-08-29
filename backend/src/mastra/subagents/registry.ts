import type { SubAgent } from '@mastra/core/agent';
import type { LanguageModelV4 } from '@ai-sdk/provider';

import { createToolRegistry, type ToolRegistry } from '../tools/registry.js';
import { createReconAgent } from './recon.agent.js';

export type SubagentRegistry = Record<string, SubAgent<string>>;

export function defineSubagentRegistry<
  const TRegistry extends SubagentRegistry,
>(subagents: TRegistry): TRegistry {
  return subagents;
}

interface SubagentRegistryOptions {
  model?: LanguageModelV4;
  toolRegistry?: ToolRegistry;
}

export function createSubagentRegistry(
  options: SubagentRegistryOptions = {},
) {
  const toolRegistry = options.toolRegistry ?? createToolRegistry();

  return defineSubagentRegistry({
    reconAgent: createReconAgent({
      model: options.model,
      toolRegistry,
    }),
  });
}
