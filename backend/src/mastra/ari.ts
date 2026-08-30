import { Agent } from '@mastra/core/agent';
import type { LanguageModelV4 } from '@ai-sdk/provider';

import type { ChatMessage } from '../contracts/chat.js';
import type { StepResult } from '../contracts/step-result.js';
import { type ExecutionTraceStep, mapToolToTraceStep } from '../contracts/trace-step.js';
import { createMainModel, createSmallModel, MAIN_REASONING_EFFORT } from './models.js';
import {
  createSubagentRegistry,
  type SubagentRegistry,
} from './subagents/registry.js';
import {
  createToolRegistry,
  selectTools,
  type ToolRegistry,
} from './tools/registry.js';

export const ARI_SYSTEM_PROMPT = `You are Ari, the enterprise AI logistics and trade operations agent for Nauta.
You serve business clients and supply chain executives. Always speak in clean, executive, professional plain English without technical jargon.

STRICT DOMAIN RESTRICTIONS & SCOPE GUARDRAILS:
1. EXCLUSIVE LOGISTICS DOMAIN: You ONLY operate within international logistics, freight forwarding, ocean/air/land transport, cargo tracking, container status, customs clearance (pedimentos, semáforo fiscal), shipment documents (BL, Invoice, Packing List), operational delay mitigation, and supply chain decisions.
2. REJECT OFF-TOPIC QUESTIONS: If the user asks about ANYTHING outside international trade, cargo, shipping, and supply chain operations (such as cooking recipes, preparing mate/tea/coffee, movies, sports, personal advice, general trivia, or general software coding):
   - You MUST immediately and politely refuse in exactly 1 brief sentence:
     "I am Ari, your Nauta logistics assistant. I am dedicated exclusively to international trade operations, shipment tracking, customs, and logistics documents. How can I help you with your shipments today?"
   - NEVER answer off-topic questions or provide instructions for cooking, recipes, or unrelated topics.

CRITICAL GENERATIVE UI & FORMATTING RULES:
1. GENERATIVE UI FIRST (MANDATORY): Your core power is driving the self-generating interface (json-render). Every valid logistics answer MUST trigger a visual UI card:
   - Call \`renderDemoTool\` for shipment status, routes, ETAs, alerts, and container progress.
   - Call \`requestHumanDecisionTool\` whenever human approval or selection between options is needed.
2. DATES: Format all dates elegantly (e.g. "September 8, 2026 (in 10 days)"). NEVER print raw ISO strings like "2026-09-08T17:17:51.734484+00:00".
3. IDENTIFIERS: Always use clean reference codes (e.g. "OP-2026-101", "MSKU1234567"). NEVER output raw database UUIDs (e.g. "c3d4e5f6-0000...").
4. CONCISE: Keep conversational text short and high-level, letting the dynamic Generative UI deliver the visual details.`;

export const ARI_INSTRUCTIONS = `${ARI_SYSTEM_PROMPT}

Your tool execution workflow:
1. 🤝 Pending Approvals & Human Decisions (HITL):
   - When asked about pending approvals or decisions, call \`getPendingDecisionsTool\`.
   - Then immediately call \`requestHumanDecisionTool\` passing:
     - \`title\`: "Pending Operational Decisions"
     - \`question\`: "The following approvals require your decision. Please select an item to review and resolve:"
     - \`severity\`: "critical" or "warning"
     - \`options\`: Array of choices formatted with clean reference codes (e.g. OP-2026-102), simple non-technical labels, and badges.
2. 🔍 Finding Cargo / Container:
   - When asked to find or track items (e.g. "Have the electronics arrived yet?", "Where are the dining tables?"), call \`searchCargoTool\` or \`findContainerTool\`.
   - If multiple shipments match, call \`requestHumanDecisionTool\` to let the user choose which shipment to view.
   - If 1 shipment matches, call \`renderDemoTool\` with the clean assistantResponse and delivery parameters (deliveryId, from, to, status, deliveryTime, issue).
3. 📄 Reading & Ingesting Documents:
   - Ari is read-only by default. The sole data-mutation exception is \`ingestDocumentTool\`, and only after the user has uploaded or pasted a document with extracted/OCR text.
   - Use \`ingestDocumentTool\` only for: Purchase Order, Booking Confirmation, Bill of Lading, Packing List, or Arrival Notice. The tool validates the content; never try to bypass or relabel that validation.
   - Reject Commercial Invoices, Pedimentos, Customs Declarations, emails, images without readable text, executables, and every other file type. Do not create, modify, delete, or status-change any record from normal conversation.
   - Do not claim to upload, download, move, delete, or store a binary file. This tool only persists validated structured facts extracted from an already-provided document.
   - When asked to inspect an existing BL, Invoice, or Packing List, call \`readDocumentTool\`.
4. 📍 Map & ETA:
   - Call \`locateMapTool\` for routes/ports and \`calculateEtaTool\` for transit time and delays.
5. 📊 Adaptive analytics UI:
   - When the user asks to compare, trend, measure, or visualize data, call \`drawChartTool\`. The resulting chart is an interactive JSON-render component: the user can move it and change its presentation locally without changing operational data.
6. 🔀 Comparing Data & Discrepancies:
   - Call \`compareDataTool\` or \`reconcileShipmentDocumentsTool\` for document discrepancies.`;

const ARI_TOOL_KEYS = [
  'requestHumanDecisionTool',
  'renderDemoTool',
  'searchCargoTool',
  'getOperationDetailsTool',
  'getPendingDecisionsTool',
  'listOperationsTool',
  'getContainerStatusTool',
  'getCustomsStatusTool',
  'getOperationalAlertsTool',
  'readDocumentTool',
  'ingestDocumentTool',
  'calculateEtaTool',
  'compareDataTool',
  'locateMapTool',
  'findContainerTool',
  'drawChartTool',
  'reconcileShipmentDocumentsTool',
  'getOperationsSummaryTool',
  'universalSearchTool',
] as const;

export interface AriOptions {
  model?: LanguageModelV4;
  smallModel?: LanguageModelV4;
  onRenderToolExecution?: () => void;
  toolRegistry?: ToolRegistry;
  subagentRegistry?: SubagentRegistry;
}

export function createAriAgent(options: AriOptions = {}) {
  const model = options.model ?? createMainModel();
  const smallModel = options.smallModel ?? options.model ?? createSmallModel();
  const toolRegistry =
    options.toolRegistry ??
    createToolRegistry({
      onRenderDemoExecution: options.onRenderToolExecution,
    });
  const subagentRegistry =
    options.subagentRegistry ??
    createSubagentRegistry({ model: smallModel, toolRegistry });

  return new Agent({
    id: 'ari',
    name: 'Ari',
    instructions: {
      role: 'system',
      content: ARI_INSTRUCTIONS,
      providerOptions: {
        openai: { reasoningEffort: MAIN_REASONING_EFFORT },
      },
    },
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
  const response = await agent.generate(modelMessages, { maxSteps: 10 });
  const chartResult = response.toolResults.find(
    ({ payload }) => payload.toolName === 'drawChartTool',
  );
  const chart = chartResult?.payload.result as
    | { title: string; chartType: 'bar' | 'line' | 'pie'; data: Array<{ label: string; value: number }> }
    | undefined;

  // 1. Recopilar detalladamente el paso a paso de cada acción realizada
  const traceSteps: ExecutionTraceStep[] = [];
  let stepIndex = 1;

  // Paso inicial: Razonamiento e inferencia
  traceSteps.push({
    id: `step-${stepIndex}`,
    stepNumber: stepIndex++,
    kind: 'thinking',
    title: 'Entendiendo tu solicitud',
    detail: 'Analizando lo que necesitas sobre tus envíos para darte una respuesta clara y directa.',
    timestamp: new Date().toISOString(),
    durationMs: 25,
  });

  // Pasos de cada herramienta / consulta ejecutada
  for (const toolResult of response.toolResults) {
    const payload = toolResult.payload as {
      toolName: string;
      args?: Record<string, unknown>;
      result?: unknown;
    };
    traceSteps.push(
      mapToolToTraceStep(payload.toolName, payload.args || {}, payload.result, stepIndex++),
    );
  }

  // Priorizar tool de Human Decision o Render Demo
  const renderResult = response.toolResults.find(
    ({ payload }) =>
      payload.toolName === 'requestHumanDecisionTool' ||
      payload.toolName === 'renderDemoTool',
  );

  if (renderResult) {
    const baseResult = renderResult.payload.result as StepResult;
    return {
      ...baseResult,
      factPatch: {
        ...baseResult.factPatch,
        ...(chart ? { chart } : {}),
        executionSteps: traceSteps,
      },
      findings: traceSteps.map((step) => ({
        id: step.id,
        statement: `${step.title}: ${step.detail}`,
        evidenceIds: [step.id],
      })),
      evidence: [
        ...baseResult.evidence,
        ...traceSteps.map((s) => ({ id: s.id, source: s.toolName || 'agent:thought' })),
      ],
    };
  }

  // Si ejecutó getPendingDecisionsTool pero no llamó a requestHumanDecisionTool, crear el StepResult interactivo automáticamente
  const pendingDecisionsResult = response.toolResults.find(
    ({ payload }) => payload.toolName === 'getPendingDecisionsTool',
  );

  if (pendingDecisionsResult) {
    const rawData = pendingDecisionsResult.payload.result as {
      decisions?: Array<{
        id: string;
        operationReference?: string;
        title: string;
        description?: string;
        severity?: string;
      }>;
    };
    const decisions = rawData.decisions || [];

    if (decisions.length > 0) {
      const options = decisions.map((d) => ({
        id: d.id,
        label: `${d.operationReference || 'Shipment'}: ${d.title}`,
        description: d.description || 'Pending human approval',
        badge: (d.severity || 'Action Required').toUpperCase(),
        actionPayload: `Review and resolve decision for ${d.operationReference || d.title}`,
      }));

      return {
        status: 'completed',
        summary: `There are ${decisions.length} operational decisions waiting for your review.`,
        factPatch: {
          assistantResponse: `There are ${decisions.length} operational decisions waiting for your review:`,
          ...(chart ? { chart } : {}),
          executionSteps: traceSteps,
          humanDecision: {
            title: 'Pending Operational Approvals',
            question: 'Please select which shipment or approval you would like to resolve:',
            severity: 'critical',
            options,
          },
        },
        findings: traceSteps.map((step) => ({
          id: step.id,
          statement: `${step.title}: ${step.detail}`,
          evidenceIds: [step.id],
        })),
        evidence: [
          { id: 'auto-hitl', source: 'json-render:HumanDecisionCard' },
          ...traceSteps.map((s) => ({ id: s.id, source: s.toolName || 'agent:thought' })),
        ],
      };
    }
  }

  // Fallback a texto limpio si no invocó render
  const textOutput = response.text || 'Query processed successfully.';
  return {
    status: 'completed',
    summary: textOutput,
    factPatch: {
      assistantResponse: textOutput,
      ...(chart ? { chart } : {}),
      executionSteps: traceSteps,
    },
    findings: traceSteps.map((step) => ({
      id: step.id,
      statement: `${step.title}: ${step.detail}`,
      evidenceIds: [step.id],
    })),
    evidence: [
      { id: 'agent-response', source: 'ari-text' },
      ...traceSteps.map((s) => ({ id: s.id, source: s.toolName || 'agent:thought' })),
    ],
  };
}
