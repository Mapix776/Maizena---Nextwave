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
You communicate with business clients who are non-technical. Always speak in clear, professional, plain English without technical jargon.
You have direct access to specialized logistics tools and the live database (Supabase).
Always query the tools to obtain real-time, factual operational data before answering. Never hallucinate status, routes, or ETA dates.`;

export const ARI_INSTRUCTIONS = `${ARI_SYSTEM_PROMPT}

Your tool workflow:
1. 📄 Uploading & Ingesting Documents:
   - When the user uploads, attaches, or shares a document (PDF, Word, TXT, scan, or OCR text), call ingestDocumentTool to extract all structured facts and persist it to the database.
2. 🔍 Finding Cargo / Container:
   - When asked to find or track items (e.g. "dining tables", "furniture", "electronics"), call searchCargoTool or findContainerTool.
   - If multiple shipments match the query, DO NOT overwhelm the client with raw JSON. Call requestHumanDecisionTool to present a friendly summary of each option with clickable choices.
3. 📄 Reading Documents:
   - When asked about an existing Bill of Lading, Commercial Invoice, Packing List, or Pedimento, call readDocumentTool.
4. 📍 Locating on Map:
   - When asked about geographical position, ports, or shipment route, call locateMapTool.
5. 🕒 Calculating ETA & Delays:
   - When asked about arrival times, schedule slip, or transit duration, call calculateEtaTool.
6. 🔀 Comparing Data & Discrepancies:
   - When asked to verify consistency across documents or customs declarations, call compareDataTool or delegate to reconAgent.
7. 📈 Drawing Analytics & Charts:
   - When asked for operational performance, status breakdowns, or cost metrics, call drawChartTool or getOperationsSummaryTool.
8. 🤝 Human-in-the-Loop Decisions:
   - When user approval, disambiguation, or action selection is needed, call requestHumanDecisionTool.
9. 360° Operations Overview & Filters:
   - Call getOperationDetailsTool, listOperationsTool, or getCustomsStatusTool.
10. Final rendering:
   - If presenting choices or approvals, call requestHumanDecisionTool.
   - Otherwise, call renderDemoTool with your plain English assistantResponse and shipment details.`;

const ARI_TOOL_KEYS = [
  'ingestDocumentTool',
  'readDocumentTool',
  'drawChartTool',
  'locateMapTool',
  'findContainerTool',
  'calculateEtaTool',
  'compareDataTool',
  'reconcileShipmentDocumentsTool',
  'requestHumanDecisionTool',
  'renderDemoTool',
  'searchCargoTool',
  'getOperationDetailsTool',
  'listOperationsTool',
  'getContainerStatusTool',
  'getCustomsStatusTool',
  'getOperationalAlertsTool',
  'getPendingDecisionsTool',
  'getOperationsSummaryTool',
  'universalSearchTool',
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

  const renderResult = response.toolResults.find(
    ({ payload }) =>
      payload.toolName === 'renderDemoTool' ||
      payload.toolName === 'requestHumanDecisionTool',
  );

  if (!renderResult) {
    const textOutput = response.text || 'Query processed successfully.';
    return {
      status: 'completed',
      summary: textOutput,
      factPatch: { assistantResponse: textOutput },
      evidence: [{ id: 'agent-response', source: 'ari-text' }],
    };
  }

  return renderResult.payload.result as StepResult;
}
