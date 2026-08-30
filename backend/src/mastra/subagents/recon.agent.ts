import { Agent } from '@mastra/core/agent';
import type { LanguageModelV4 } from '@ai-sdk/provider';

import {
  createSmallModel,
  SMALL_REASONING_EFFORT,
} from '../models.js';
import {
  createToolRegistry,
  selectTools,
  type ToolRegistry,
} from '../tools/registry.js';

export const RECON_INSTRUCTIONS = `You are Recon, Nauta's document-reconciliation specialist.

Reconcile extracted facts from the Bill of Lading, Commercial Invoice, and
Packing List. When all three document snapshots are available, call
reconcileShipmentDocumentsTool exactly once. Explain every discrepancy and its
severity. A container-number mismatch is critical; weight or amount mismatches
are warnings. Never mutate operations, override discrepancies, or approve a
decision.`;

const RECON_TOOL_KEYS = ['reconcileShipmentDocumentsTool'] as const;

interface ReconAgentOptions {
  model?: LanguageModelV4;
  toolRegistry?: ToolRegistry;
}

export function createReconAgent(options: ReconAgentOptions = {}) {
  const toolRegistry = options.toolRegistry ?? createToolRegistry();

  return new Agent({
    id: 'recon',
    name: 'Recon',
    description:
      'Reconciles Bill of Lading, Commercial Invoice, and Packing List facts across container number, weight, and amount; reports warning or critical discrepancies.',
    instructions: {
      role: 'system',
      content: RECON_INSTRUCTIONS,
      providerOptions: {
        openai: { reasoningEffort: SMALL_REASONING_EFFORT },
      },
    },
    model: options.model ?? createSmallModel(),
    tools: selectTools(toolRegistry, RECON_TOOL_KEYS),
  });
}
