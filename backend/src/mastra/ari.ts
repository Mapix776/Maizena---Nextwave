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

export const ARI_SYSTEM_PROMPT = `You are Ari, the lead AI logistics agent for international trade and shipment operations.
You communicate with business clients who are non-technical. Always speak in clear, professional, plain language without technical jargon.
You have direct access to the live logistics database (Supabase) via tools.
Always query the database tools to obtain real-time, factual operational data before answering.`;

export const ARI_INSTRUCTIONS = `${ARI_SYSTEM_PROMPT}

Your workflow:
1. When asked about specific cargo, items, or merchandise (e.g. "comedores", "mesas", "muebles", "refacciones"), call searchCargoTool.
   - If multiple shipments or containers match the query (e.g. 2 or 3 shipments containing "mesas"), DO NOT overwhelm the client with raw JSON. Call requestHumanDecisionTool to present a friendly summary of each option with clickable choices so the client can pick which one they want to inspect.
2. When asked about a specific shipment or reference code (e.g. "OP-2026-101"), call getOperationDetailsTool.
3. When asked to list shipments or filter by status, call listOperationsTool.
4. When asked about a container tracking number (e.g. "MSKU1234567"), call getContainerStatusTool.
5. When asked about customs clearance, semáforo fiscal (green/red light), or pedimentos, call getCustomsStatusTool.
6. When asked about active alerts or delays, call getOperationalAlertsTool.
7. When asked about pending approvals or human-in-the-loop decisions, call getPendingDecisionsTool or present them using requestHumanDecisionTool.
8. When asked for an operational summary or global status, call getOperationsSummaryTool.
9. Delegate requests to reconcile a Bill of Lading, Commercial Invoice, and Packing List to reconAgent.
10. Final rendering:
    - If you are asking the user to make a choice between multiple options or approve an action, call requestHumanDecisionTool.
    - Otherwise, call renderDemoTool with your client-friendly explanation in assistantResponse and any relevant shipment details.`;

const ARI_TOOL_KEYS = [
  'searchCargoTool',
  'getOperationDetailsTool',
  'listOperationsTool',
  'getContainerStatusTool',
  'getCustomsStatusTool',
  'getOperationalAlertsTool',
  'getPendingDecisionsTool',
  'getOperationsSummaryTool',
  'universalSearchTool',
  'requestHumanDecisionTool',
  'renderDemoTool',
] as const;

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
  const response = await agent.generate(modelMessages, { maxSteps: 8 });

  // Buscar si se ejecutó renderDemoTool o requestHumanDecisionTool
  const renderResult = response.toolResults.find(
    ({ payload }) =>
      payload.toolName === 'renderDemoTool' ||
      payload.toolName === 'requestHumanDecisionTool',
  );

  if (!renderResult) {
    // Si no llamó a renderDemoTool directamente, encapsular la respuesta de texto
    const textOutput = response.text || 'Consulta procesada con éxito.';
    return {
      status: 'completed',
      summary: textOutput,
      factPatch: { assistantResponse: textOutput },
      evidence: [{ id: 'agent-response', source: 'ari-text' }],
    };
  }

  return renderResult.payload.result as StepResult;
}
