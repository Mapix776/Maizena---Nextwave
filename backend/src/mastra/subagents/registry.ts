import type { SubAgent } from '@mastra/core/agent';

export type SubagentRegistry = Record<string, SubAgent<string>>;

export function defineSubagentRegistry<
  const TRegistry extends SubagentRegistry,
>(subagents: TRegistry): TRegistry {
  return subagents;
}
