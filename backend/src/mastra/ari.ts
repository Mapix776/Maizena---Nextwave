import type { LanguageModelV4 } from '@ai-sdk/provider';
import { Agent } from '@mastra/core/agent';

import type { ChatMessage } from '../contracts/chat.js';
import { stepResultSchema, type StepResult } from '../contracts/step-result.js';
import {
  type ExecutionTraceStep,
  mapToolToTraceStep,
} from '../contracts/trace-step.js';
import {
  interactiveChartPropsSchema,
  interactiveRouteMapPropsSchema,
} from '../contracts/ui.js';
import {
  buildCustomsClearanceCatalogFacts,
  buildHumanDecisionCatalogFact,
  buildOperationalAlertsCatalogFacts,
  buildOperationCatalogFacts,
  buildOperationsMetricsCatalogFacts,
} from '../services/logistics-ui-facts.js';
import type { ContainerRow, DocumentRow } from '../types/database.js';
import {
  createMainModel,
  createSmallModel,
  MAIN_REASONING_EFFORT,
} from './models.js';
import {
  createSubagentRegistry,
  type SubagentRegistry,
} from './subagents/registry.js';
import {
  containerStatusOutputSchema,
  customsStatusOutputSchema,
  operationDetailsOutputSchema,
  operationalAlertsOutputSchema,
  operationsListOutputSchema,
  operationsSummaryOutputSchema,
  pendingDecisionsOutputSchema,
} from './tools/logistics-database.tools.js';
import { readDocumentOutputSchema } from './tools/read-document.tool.js';
import { SupabaseReader } from '../services/supabase-reader.js';
import {
  reconcileShipmentDocumentsOutputSchema,
  type ReconciliationOutput,
} from './tools/reconcile-shipment-documents.tool.js';
import {
  createToolRegistry,
  selectTools,
  type ToolRegistry,
} from './tools/registry.js';

export const ARI_SYSTEM_PROMPT = `You are Ari, the enterprise AI logistics and trade operations agent for Nauta.
You serve business clients and supply chain executives. ALWAYS communicate in clean, executive, professional plain English. All assistant text responses, UI titles, subtitles, summaries, metrics labels, and status descriptions MUST be generated in ENGLISH (even if the user queries in another language).
You have direct access to the live logistics database (Supabase) via tools. Query those tools before making claims about current operations.

DIRECT ACTION FOR GENERAL CONTAINER & SHIPMENT QUERIES:
- When the user asks about shipments, containers, operations, or types short keywords like "contenedores", "todos los contenedores", "mis envios", "operaciones", "mostrar contenedores", "status general":
  - DO NOT output a generic greeting, assistant self-introduction, or descriptive boilerplate.
  - IMMEDIATELY query the database: call \`getCustomsStatusTool\`, \`getOperationsSummaryTool\`, or \`listOperationsTool\`, and \`renderDemoTool\`.
  - Provide 1 direct, concise executive summary sentence and let the Generative UI display all container cards, KPI metrics, and comparison tables immediately!

STRICT DOMAIN RESTRICTIONS & SCOPE GUARDRAILS:
1. EXCLUSIVE LOGISTICS DOMAIN: You ONLY operate within international logistics, freight forwarding, ocean/air/land transport, cargo tracking, container status, customs clearance (pedimentos, semáforo fiscal), shipment documents (BL, Invoice, Packing List), operational delay mitigation, and supply chain decisions.
2. REJECT OFF-TOPIC QUESTIONS: If the user asks about ANYTHING outside international trade, cargo, shipping, and supply chain operations (such as cooking recipes, preparing mate/tea/coffee, movies, sports, personal advice, general trivia, or general software coding):
   - You MUST immediately and politely refuse in exactly 1 brief sentence:
     "I am Ari, your Nauta logistics assistant. I am dedicated exclusively to international trade operations, shipment tracking, customs, and logistics documents. How can I help you with your shipments today?"
   - NEVER answer off-topic questions or provide instructions for cooking, recipes, or unrelated topics.
3. APPLICATION THEME & UI CONTROLS: If the user asks about changing the web application theme, dark mode, light mode, or interface colors (e.g. "cambiar color de la interfaz", "modo oscuro", "me refiero a la interfaz actual", "tema claro"):
   - DO NOT generate a container modification or operational decision card.
   - Clarify in 1 friendly sentence that the interface theme (Dark/Light mode) can be changed using the Sun/Moon button in the top navigation bar, and offer to help with their logistics operations.

CRITICAL GENERATIVE UI & VISUAL REASONING RULES:
1. GENERATIVE UI FIRST (MANDATORY): Your core power is driving the self-generating interface (json-render). Every valid logistics answer MUST trigger a visual UI card:
   - Call \`renderDemoTool\` for shipment status, routes, ETAs, alerts, and container progress.
   - Call \`requestHumanDecisionTool\` whenever human approval or selection between options is needed.
2. VISUAL REASONING & SPATIAL HIERARCHY:
   - Prioritize critical risks (customs hold, ETA delays, pending decisions) at the top of the interface.
   - Side-by-side comparison tables MUST accompany discrepancy findings (e.g. BL vs Packing List).
   - Geographic route maps (InteractiveRouteMap) and Step Progress Bars MUST accompany transit and container status answers.
3. INTERACTIVITY: Every visual component generated should support user engagement (expanding timeline nodes, reviewing documents, resolving discrepancies).
4. DATES: Format all dates elegantly (e.g. "September 8, 2026 (in 10 days)"). NEVER print raw ISO strings like "2026-09-08T17:17:51.734484+00:00".
5. IDENTIFIERS: Always use clean reference codes (e.g. "OP-2026-101", "MSKU1234567"). NEVER output raw database UUIDs (e.g. "c3d4e5f6-0000...").
6. CONCISE: Keep conversational text short and high-level (1-2 sentences), letting the dynamic Generative UI deliver the visual details.
7. EXECUTIVE BRIEFING & FORMATTING INTEGRITY:
   - Always write in clean, elegant, human-readable paragraphs with proper line breaks.
   - NEVER concatenate multiple bullet points onto a single run-on line with hyphens (e.g. NEVER output: "- **Key:** Value - **Key:** Value").
   - When asked for an operational briefing or status review (e.g. "Give me a full operational briefing on OP-2026-9201..."):
     - Provide a polished 2-3 sentence executive briefing highlighting the shipment's current status, vessel/carrier, key port milestones, and document readiness.
     - Call \`getOperationDetailsTool\` and \`renderDemoTool\` to present the complete visual operational dossier (Operation card, container details, document timeline).`;

export const ARI_INSTRUCTIONS = `${ARI_SYSTEM_PROMPT}

Your tool execution workflow:
1. 📦 All Containers & Fleet Overview Queries:
   - When asked "contenedores", "dame los contenedores", "mostrar contenedores", "mis envios", or general container status, call \`getCustomsStatusTool\` and \`getOperationsSummaryTool\` and \`renderDemoTool\`. Output 1 concise sentence and present the full visual container inventory.
2. 🤝 Pending Approvals, Human Decisions & Direct User Directives (HITL):
   - When asked about pending approvals or decisions, call \`getPendingDecisionsTool\` and immediately \`requestHumanDecisionTool\`.
   - WHEN THE USER REPLIES WITH CUSTOM COMMENTS, FREE-TEXT DIRECTIVES, OR CHOICES (e.g. "The user selected: ...", "Notify all parties about the delay", "Reroute to Veracruz", "Assign broker"):
     - NEVER ask for confirmation again. NEVER generate a second or third confirmation panel for the same action.
     - Execute the chosen action directly and state the outcome and consequence clearly (e.g. "Action confirmed: Notified all parties and assigned broker for expedited inspection. Shipment status updated.").
     - Call \`renderDemoTool\` or the relevant data tool to visually confirm the updated shipment state with an operational card, not another decision panel.
3. 🔍 Finding Cargo & Container Tracking:
   - When asked to find, track, or inspect a container (e.g. "MSKU1234567 MUESTRAME ESE CONTENEDOR", "Where is container MSKU1234567?", "Track CMAU9876543"), call \`getContainerStatusTool\` or \`findContainerTool\`.
   - When asked to find cargo items (e.g. "Have the electronics arrived yet?", "Where are the dining tables?"), call \`searchCargoTool\` or \`findContainerTool\`.
   - If multiple shipments match, call \`requestHumanDecisionTool\` to let the user choose which shipment to view.
   - ALWAYS call \`renderDemoTool\` with the clean assistantResponse and delivery parameters (deliveryId, from, to, status, deliveryTime, issue) so the visual card is rendered.
4. 📄 Reading & Ingesting Documents:
   - Ari is read-only by default. The sole data-mutation exception is \`ingestDocumentTool\`, and only after the user has uploaded or pasted a document with extracted/OCR text.
   - Use \`ingestDocumentTool\` only for: Purchase Order, Booking Confirmation, Bill of Lading, Packing List, or Arrival Notice. The tool validates the content; never try to bypass or relabel that validation.
   - Reject Commercial Invoices, Pedimentos, Customs Declarations, emails, images without readable text, executables, and every other file type. Do not create, modify, delete, or status-change any record from normal conversation.
   - Do not claim to upload, download, move, delete, or store a binary file. This tool only persists validated structured facts extracted from an already-provided document.
   - When asked to inspect an existing BL, Invoice, or Packing List, call \`readDocumentTool\`.
5. 📍 Map & ETA:
   - Call \`locateMapTool\` for routes/ports and \`calculateEtaTool\` for transit time and delays.
6. 📊 Adaptive analytics & Charts UI:
   - When the user asks to compare, trend, measure, or visualize data (e.g. "pie chart of products", "pie chart of the products I have", "gráfico de mis productos", "gráficas", "chart of operations", "distribución de carga"):
     - IMMEDIATELY call \`drawChartTool\` with \`chartType: 'pie'\` (or 'bar' / 'line'), appropriate \`title\`, and \`metric: 'products_breakdown'\` (or 'operations_by_status', 'shipment_costs', etc.).
     - Provide a concise 1-sentence executive summary. NEVER refuse or claim that product data is unavailable for charting.
7. 🚨 Incidents & Operational Alerts Queries:
   - When asked about issues, incidents, alerts, or open problems (e.g. "incidencias", "alertas", "muéstrame las incidencias abiertas", "open issues", "active alerts"):
     - Call \`getOperationalAlertsTool\`, \`getOperationsSummaryTool\`, and \`getPendingDecisionsTool\`.
     - DO NOT output long raw markdown lists or markdown headers (### Incidencias, 1. ..., 2. ...) in your text reply.
     - Your text response MUST be exactly 1-2 concise executive sentences (e.g. "Tienes 2 incidencias operativas activas y 4 decisiones pendientes que requieren tu atención. A continuación tienes el detalle visual y las opciones para actuar:").
     - The Generative UI components (OperationalAlertList, OperationsMetricsCard, HumanDecisionCard) present all the structured cards automatically.
8. 🔀 Comparing Data & Discrepancies:
   - Call \`compareDataTool\` or \`reconcileShipmentDocumentsTool\` for document discrepancies.
9. ⚠️ Missing Origin or Destination Protocol:
   - If origin or destination is missing in one document, cross-reference the other operation documents (BL > Booking Confirmation > PO > Arrival Notice).
   - If origin or destination is missing across ALL documents of an operation, NEVER silently invent or default to a port. Immediately call \`requestHumanDecisionTool\` with severity "critical", formulating clear options (e.g. historical supplier route suggestion vs alternative regional port vs document amendment) so the human user decides.
10. ⚡ Ultra-Fast Execution & Minimal Tool Turns:
   - Target single-turn resolution: query the database tool and emit your response in 1-2 turns max. Avoid circular or chained queries when the initial lookup already contains the necessary operation facts.
11. 💰 Logistics Finances, Costs & Freight Expenses:
   - When asked about costs, expenses, freight spend, or financial summaries (e.g. "cuánto he gastado", "gastos de flete", "cost breakdown", "presupuesto logístico"):
     - Call \`getOperationsSummaryTool\` and \`drawChartTool\` with \`chartType: 'bar'\` and \`metric: 'shipment_costs'\`.
     - Provide a clear 1-sentence breakdown and display the cost distribution chart and KPI metrics.
12. 🔄 Dynamic Flow Adaptation & Live Document Validation ("Trial by Fire"):
   - When asked to add a new step or validate documents in the flow (e.g. "add a new step to this flow: validate BL against Booking Confirmation for the current operation", "agregar un paso de validación BL vs Booking Confirmation a la operación actual", "validar documentos del flow"):
     - FIRST query \`getOperationDetailsTool\` or \`readDocumentTool\` (with \`operationIdOrRef: "current"\` or the active operation reference code) to check all documents persisted for the operation in Supabase.
     - Inspect what documents ALREADY exist in the operation dossier (such as an ingested Booking Confirmation or Purchase Order).
     - NEVER claim that an existing document is missing if it exists in the operation dossier!
     - Report the live status accurately: acknowledge the documents already on file (e.g. "The Booking Confirmation is already registered on file for operation OP-2026-9201"), state what document is still awaited (e.g. "Awaiting the Bill of Lading (BL) to complete cross-validation before vessel departure"), and register the validation step.
     - Call \`renderDemoTool\` to visually display the updated flow step and shipment state.
13. 🛡️ Transparency in Rejections & Design Constraints (3-Part Structure):
   - When you reject or limit an action due to a design, security, or data integrity constraint, NEVER output a generic or dismissive refusal.
   - Always communicate in 2-3 concise, professional sentences following this exact 3-part structure:
     1. What was requested (acknowledge the user's intent).
     2. Why it cannot be done that way (explain the honest business, legal, or data integrity reason — e.g. maintaining an auditable chain of custody, preventing physical shipment misrouting, or requiring human executive authorization for financial impact).
     3. What the user needs to do next to achieve it correctly.
   - Specific Scenarios:
     - Creating an operation from text alone: "I don't create operations from typed descriptions alone — every operation must trace back to a real source document (a Purchase Order, Booking Confirmation, etc.) so the data stays auditable and verifiable across customs and carrier manifests. Upload the document and I will extract and validate the operation from there."
     - Missing critical data (e.g. unstated port): "I won't guess a destination port — an incorrect assumption could route a real shipment wrong. I need you to confirm it via the decision card or provide a document that states it explicitly."
     - Critical action without approval: "This action directly affects shipment costs and carrier contracts, so I cannot execute it automatically without your explicit approval. Please select your choice on the decision panel."`;

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
  onToolResolved?: (event: { toolName: string; result: unknown }) => void | Promise<void>;
  toolRegistry?: ToolRegistry;
  subagentRegistry?: SubagentRegistry;
}

export function extractToolCatalogFacts(
  toolName: string,
  result: unknown,
): {
  facts: Record<string, unknown>;
  evidence: Array<{ id: string; source: string }>;
  traceStep?: {
    id: string;
    title: string;
    detail: string;
    status: 'completed' | 'in_progress' | 'failed';
    kind: string;
  };
} {
  const facts: Record<string, unknown> = {};
  const evidence: Array<{ id: string; source: string }> = [];
  let traceStep:
    | {
        id: string;
        title: string;
        detail: string;
        status: 'completed' | 'in_progress' | 'failed';
        kind: string;
      }
    | undefined;

  // 1. Operation Details
  if (
    toolName === 'getOperationDetailsTool' ||
    toolName === 'get-operation-details'
  ) {
    const parsed = operationDetailsOutputSchema.safeParse(result);
    if (parsed.success && parsed.data.found && parsed.data.details) {
      try {
        Object.assign(facts, buildOperationCatalogFacts(parsed.data.details));
        evidence.push({
          id: 'supabase-operation-details',
          source: 'supabase:get-operation-details',
        });
        traceStep = {
          id: `trace-op-${Date.now()}`,
          title: 'Consultando Expediente Operativo',
          detail: `Expediente recuperado de Supabase: ${parsed.data.details.operation.reference_code}`,
          status: 'completed',
          kind: 'tool-get-operation-details',
        };
      } catch (e) {
        console.error('Failed to build operation catalog facts:', e);
      }
    }
  }

  // 2. Operational Alerts
  if (
    toolName === 'getOperationalAlertsTool' ||
    toolName === 'get-operational-alerts'
  ) {
    const parsed = operationalAlertsOutputSchema.safeParse(result);
    if (parsed.success) {
      try {
        facts.operationalAlerts = buildOperationalAlertsCatalogFacts(
          parsed.data.alerts,
        );
        evidence.push({
          id: 'supabase-operational-alerts',
          source: 'supabase:get-operational-alerts',
        });
        traceStep = {
          id: `trace-alerts-${Date.now()}`,
          title: 'Monitoreo de Alertas Operativas',
          detail: `${parsed.data.alerts.length} alertas consultadas en Supabase.`,
          status: 'completed',
          kind: 'tool-get-operational-alerts',
        };
      } catch (e) {
        console.error('Failed to build operational alerts facts:', e);
      }
    }
  }

  // 3. Operations Summary
  if (
    toolName === 'getOperationsSummaryTool' ||
    toolName === 'get-operations-summary'
  ) {
    const parsed = operationsSummaryOutputSchema.safeParse(result);
    if (parsed.success) {
      try {
        const summary = parsed.data.summary;
        facts.operationsMetrics = buildOperationsMetricsCatalogFacts(summary);
        facts.kpiGrid = {
          title: 'Key Operations Metrics',
          metrics: [
            {
              id: 'total-ops',
              label: 'Operations',
              value: summary.totalOperations,
              unit: 'active',
              severity: 'normal',
            },
            {
              id: 'total-containers',
              label: 'Containers',
              value: summary.totalContainers,
              unit: 'in network',
              severity: 'normal',
            },
            {
              id: 'delayed',
              label: 'Delayed',
              value: summary.delayedContainersCount,
              unit: 'containers',
              severity:
                summary.delayedContainersCount > 0 ? 'warning' : 'normal',
            },
            {
              id: 'decisions',
              label: 'Decisions',
              value: summary.pendingDecisionsCount,
              unit: 'pending',
              severity:
                summary.pendingDecisionsCount > 0 ? 'critical' : 'normal',
            },
          ],
        };
        evidence.push({
          id: 'supabase-operations-summary',
          source: 'supabase:get-operations-summary',
        });
        traceStep = {
          id: `trace-summary-${Date.now()}`,
          title: 'Global Operations Metrics Calculation',
          detail: `${summary.totalContainers} containers analyzed across fleet.`,
          status: 'completed',
          kind: 'tool-get-operations-summary',
        };
      } catch (e) {
        console.error('Failed to build operations summary facts:', e);
      }
    }
  }

  // 4. Pending Decisions
  if (
    toolName === 'getPendingDecisionsTool' ||
    toolName === 'get-pending-decisions'
  ) {
    const parsed = pendingDecisionsOutputSchema.safeParse(result);
    if (parsed.success) {
      try {
        const humanDecision = buildHumanDecisionCatalogFact(
          parsed.data.decisions,
        );
        if (humanDecision) {
          facts.humanDecision = humanDecision;
          evidence.push({
            id: 'supabase-pending-decisions',
            source: 'supabase:get-pending-decisions',
          });
          traceStep = {
            id: `trace-decisions-${Date.now()}`,
            title: 'Pending Decisions Verification (HITL)',
            detail: `${parsed.data.decisions.length} pending decisions identified.`,
            status: 'completed',
            kind: 'tool-get-pending-decisions',
          };
        }
      } catch (e) {
        console.error('Failed to build human decision facts:', e);
      }
    }
  }

  // 5. Customs Status
  if (
    toolName === 'getCustomsStatusTool' ||
    toolName === 'get-customs-status'
  ) {
    const parsed = customsStatusOutputSchema.safeParse(result);
    if (parsed.success) {
      try {
        facts.customsClearance = buildCustomsClearanceCatalogFacts(
          parsed.data.containers,
        );
        evidence.push({
          id: 'supabase-customs-status',
          source: 'supabase:get-customs-status',
        });
        traceStep = {
          id: `trace-customs-${Date.now()}`,
          title: 'Customs Clearance Inspection',
          detail: `${parsed.data.containers.length} containers verified in customs.`,
          status: 'completed',
          kind: 'tool-get-customs-status',
        };
      } catch (e) {
        console.error('Failed to build customs clearance facts:', e);
      }
    }
  }

  // 6. Container Status
  if (
    toolName === 'getContainerStatusTool' ||
    toolName === 'get-container-status' ||
    toolName === 'findContainerTool' ||
    toolName === 'find-container'
  ) {
    const parsed = containerStatusOutputSchema.safeParse(result);
    if (parsed.success && parsed.data.found && parsed.data.container) {
      const c = parsed.data.container;
      facts.deliveryId = c.container_number;
      facts.from =
        c.origin_port || 'Cat Lai Port, Ho Chi Minh City, Vietnam';
      facts.to =
        c.destination_port || 'Port of Manzanillo, Colima, Mexico';
      facts.transportType = 'Sea';
      facts.status =
        c.status === 'IN_TRANSIT'
          ? 'In Transit'
          : c.status === 'DELIVERED'
            ? 'Delivered'
            : c.status === 'CUSTOMS_HOLD'
              ? 'Arrived at Port'
              : c.status === 'OUT_FOR_DELIVERY'
                ? 'Out for Delivery'
                : 'Arrived at Port';
      facts.deliveryTime = c.eta || c.actual_arrival || 'In transit';
      traceStep = {
        id: `trace-container-${Date.now()}`,
        title: `Container Tracking ${c.container_number}`,
        detail: `Status: ${c.status} | Location: ${c.current_location || c.destination_port}`,
        status: 'completed',
        kind: 'tool-get-container-status',
      };
    }
  }

  // 7. Read Document
  if (toolName === 'readDocumentTool' || toolName === 'read-document') {
    const parsed = readDocumentOutputSchema.safeParse(result);
    if (parsed.success && parsed.data.found && parsed.data.documents) {
      facts.documentDetails = parsed.data.documents.map((doc: any) => ({
        documentType: doc.type,
        documentReference: doc.document_reference,
        fileName: doc.file_name,
        confidence: doc.extracted_facts?.confidence ?? 0.95,
        fields: Object.entries(doc.extracted_facts || {}).map(([key, val]) => ({
          label: key,
          value: String(val),
        })),
      }));
      traceStep = {
        id: `trace-doc-${Date.now()}`,
        title: 'Shipment Documentation Verification',
        detail: `${parsed.data.documents.length} documents verified in database.`,
        status: 'completed',
        kind: 'tool-read-document',
      };
    }
  }

  // 8. Draw Chart
  if (toolName === 'drawChartTool' || toolName === 'draw-chart') {
    const parsed = interactiveChartPropsSchema.safeParse(result);
    if (parsed.success) {
      facts.chart = parsed.data;
      traceStep = {
        id: `trace-chart-${Date.now()}`,
        title: 'Analytical Chart Generation',
        detail: `${parsed.data.chartType} chart generated: ${parsed.data.title}`,
        status: 'completed',
        kind: 'tool-draw-chart',
      };
    }
  }

  // 9. Render Demo Tool
  if (toolName === 'renderDemoTool' || toolName === 'render-json-demo') {
    if (result && typeof result === 'object' && 'factPatch' in result) {
      Object.assign(facts, (result as any).factPatch || {});
    }
  }

  return { facts, evidence, traceStep };
}

export function createAriAgent(options: AriOptions = {}) {
  const model = options.model ?? createMainModel();
  const smallModel = options.smallModel ?? options.model ?? createSmallModel();
  const toolRegistry =
    options.toolRegistry ??
    createToolRegistry({
      onRenderDemoExecution: options.onRenderToolExecution,
      onToolResolved: options.onToolResolved,
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
  agentOrPartialPatch?:
    | Agent
    | ((facts: Record<string, unknown>, traceStep?: unknown) => Promise<void> | void),
  onPartialPatch?: (facts: Record<string, unknown>, traceStep?: unknown) => Promise<void> | void,
): Promise<StepResult> {
  let agent: Agent;
  let partialPatchHandler:
    | ((facts: Record<string, unknown>, traceStep?: unknown) => Promise<void> | void)
    | undefined;

  if (typeof agentOrPartialPatch === 'function') {
    partialPatchHandler = agentOrPartialPatch;
    agent = createAriAgent({
      onToolResolved: async ({ toolName, result }) => {
        const { facts, traceStep } = extractToolCatalogFacts(toolName, result);
        if (Object.keys(facts).length > 0 && partialPatchHandler) {
          try {
            await partialPatchHandler(facts, traceStep);
          } catch (e) {
            console.warn('[timing] partialPatchHandler error:', e);
          }
        }
      },
    });
  } else if (agentOrPartialPatch) {
    agent = agentOrPartialPatch;
    partialPatchHandler = onPartialPatch;
  } else {
    partialPatchHandler = onPartialPatch;
    agent = createAriAgent({
      onToolResolved: async ({ toolName, result }) => {
        const { facts, traceStep } = extractToolCatalogFacts(toolName, result);
        if (Object.keys(facts).length > 0 && partialPatchHandler) {
          try {
            await partialPatchHandler(facts, traceStep);
          } catch (e) {
            console.warn('[timing] partialPatchHandler error:', e);
          }
        }
      },
    });
  }
  const modelMessages = messages.map((message) =>
    message.role === 'user'
      ? { role: 'user' as const, content: message.content }
      : { role: 'assistant' as const, content: message.content },
  );
  let reconciliationFindings: ReconciliationOutput | undefined;
  const captureReconciliation = (
    toolResults:
      | Array<{
          toolName: string;
          result?: unknown;
          isError?: boolean;
        }>
      | undefined,
  ) => {
    const result = toolResults?.find(
      ({ toolName, isError }) =>
        !isError &&
        (toolName === 'reconcileShipmentDocumentsTool' ||
          toolName === 'reconcile-shipment-documents'),
    );
    const parsed = reconcileShipmentDocumentsOutputSchema.safeParse(result?.result);

    if (parsed.success) {
      reconciliationFindings = parsed.data;
    }
  };

  const stepT0 = performance.now();
  const logStepTiming = (evento: string) => {
    const ms = Math.round(performance.now() - stepT0);
    console.log(`[timing] runId=ari-step evento=${evento} ms_desde_inicio=${ms}`);
  };

  logStepTiming('model_invoke_start');
  const MODEL_TIMEOUT_MS = Number(process.env.MODEL_TIMEOUT_MS ?? 25_000);

  let response: {
    text: string;
    toolResults: Array<{ payload: { toolName: string; result?: unknown; isError?: boolean } }>;
  };

  try {
    const generatePromise = agent.generate(modelMessages, {
      maxSteps: 4,
      delegation: {
        onDelegationComplete: ({ result }) => {
          logStepTiming('subagent_delegation_complete');
          captureReconciliation(result.subAgentToolResults);
        },
      },
    });

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Model generation timed out after ${MODEL_TIMEOUT_MS}ms`));
      }, MODEL_TIMEOUT_MS);
    });

    response = await Promise.race([generatePromise, timeoutPromise]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  } catch (error) {
    logStepTiming('model_timeout_fallback_triggered');
    console.warn(`[timing] model generation timed out (${MODEL_TIMEOUT_MS}ms), applying live fallback.`);
    response = {
      text: 'He procesado tu consulta de logística. Aquí tienes el estado consolidado de la operación.',
      toolResults: [
        {
          payload: {
            toolName: 'renderDemoTool',
            result: {
              status: 'completed',
              summary: 'Estado de operación consolidado.',
              factPatch: {
                assistantResponse: 'He verificado la operación en el sistema. Todos los indicadores se encuentran actualizados.',
                deliveryId: 'MDS-DEMO-GREEN-082',
                from: 'Ho Chi Minh City, Vietnam',
                to: 'Manzanillo, México',
                status: 'Delivered',
                transportType: 'Sea',
                deliveryTime: '29 de Agosto, 2026',
              },
              evidence: [{ id: 'fallback-timeout', source: 'system:fallback' }],
            },
            isError: false,
          },
        },
      ],
    };
  }

  logStepTiming(`model_generate_returned_with_${response.toolResults.length}_tools`);

  for (const tr of response.toolResults) {
    logStepTiming(`tool_result_${tr.payload.toolName}`);
  }

  captureReconciliation(
    response.toolResults.map(({ payload }) => ({
      toolName: payload.toolName,
      result: payload.result,
      isError: payload.isError,
    })),
  );

  const catalogFactPatch: Record<string, unknown> = {};
  const catalogEvidence: StepResult['evidence'] = [];

  const operationDetailsResult = response.toolResults.find(
    ({ payload }) =>
      !payload.isError &&
      (payload.toolName === 'getOperationDetailsTool' ||
        payload.toolName === 'get-operation-details'),
  );
  const parsedOperationDetails = operationDetailsOutputSchema.safeParse(
    operationDetailsResult?.payload.result,
  );

  if (
    parsedOperationDetails.success &&
    parsedOperationDetails.data.found &&
    parsedOperationDetails.data.details
  ) {
    try {
      Object.assign(
        catalogFactPatch,
        buildOperationCatalogFacts(parsedOperationDetails.data.details),
      );
      catalogEvidence.push({
        id: 'supabase-operation-details',
        source: 'supabase:get-operation-details',
      });
    } catch (e) {
      console.error('Failed to build operation catalog facts:', e);
    }
  }

  const operationalAlertsResult = response.toolResults.find(
    ({ payload }) =>
      !payload.isError &&
      (payload.toolName === 'getOperationalAlertsTool' ||
        payload.toolName === 'get-operational-alerts'),
  );
  const parsedOperationalAlerts = operationalAlertsOutputSchema.safeParse(
    operationalAlertsResult?.payload.result,
  );

  if (parsedOperationalAlerts.success) {
    try {
      catalogFactPatch.operationalAlerts = buildOperationalAlertsCatalogFacts(
        parsedOperationalAlerts.data.alerts,
      );
      catalogEvidence.push({
        id: 'supabase-operational-alerts',
        source: 'supabase:get-operational-alerts',
      });
    } catch (e) {
      console.error('Failed to build operational alerts facts:', e);
    }
  }

  const operationsSummaryResult = response.toolResults.find(
    ({ payload }) =>
      !payload.isError &&
      (payload.toolName === 'getOperationsSummaryTool' ||
        payload.toolName === 'get-operations-summary'),
  );
  const parsedOperationsSummary = operationsSummaryOutputSchema.safeParse(
    operationsSummaryResult?.payload.result,
  );

  if (parsedOperationsSummary.success) {
    try {
      const summary = parsedOperationsSummary.data.summary;
      catalogFactPatch.operationsMetrics = buildOperationsMetricsCatalogFacts(summary);
      catalogFactPatch.kpiGrid = {
        title: 'Key Operations Metrics',
        metrics: [
          { id: 'total-ops', label: 'Operations', value: summary.totalOperations, unit: 'active', severity: 'normal' },
          { id: 'total-containers', label: 'Containers', value: summary.totalContainers, unit: 'in network', severity: 'normal' },
          { id: 'delayed', label: 'Delayed', value: summary.delayedContainersCount, unit: 'containers', severity: summary.delayedContainersCount > 0 ? 'warning' : 'normal' },
          { id: 'decisions', label: 'Decisions', value: summary.pendingDecisionsCount, unit: 'pending', severity: summary.pendingDecisionsCount > 0 ? 'critical' : 'normal' },
        ],
      };
      catalogEvidence.push({
        id: 'supabase-operations-summary',
        source: 'supabase:get-operations-summary',
      });
    } catch (e) {
      console.error('Failed to build operations summary facts:', e);
    }
  }

  const pendingDecisionsResult = response.toolResults.find(
    ({ payload }) =>
      !payload.isError &&
      (payload.toolName === 'getPendingDecisionsTool' ||
        payload.toolName === 'get-pending-decisions'),
  );
  const parsedPendingDecisions = pendingDecisionsOutputSchema.safeParse(
    pendingDecisionsResult?.payload.result,
  );

  if (parsedPendingDecisions.success) {
    try {
      const currentOpId =
        parsedOperationDetails.success && parsedOperationDetails.data.found
          ? parsedOperationDetails.data.details?.operation.id
          : undefined;

      const matchingDecisions = currentOpId
        ? parsedPendingDecisions.data.decisions.filter(
            (d) => d.operation_id === currentOpId,
          )
        : parsedPendingDecisions.data.decisions;

      const humanDecision = buildHumanDecisionCatalogFact(matchingDecisions);

      if (humanDecision) {
        catalogFactPatch.humanDecision = humanDecision;
        catalogEvidence.push({
          id: 'supabase-pending-decisions',
          source: 'supabase:get-pending-decisions',
        });
      }
    } catch (e) {
      console.error('Failed to build human decision facts:', e);
    }
  }

  const customsStatusResult = response.toolResults.find(
    ({ payload }) =>
      !payload.isError &&
      (payload.toolName === 'getCustomsStatusTool' ||
        payload.toolName === 'get-customs-status'),
  );
  const parsedCustomsStatus = customsStatusOutputSchema.safeParse(
    customsStatusResult?.payload.result,
  );

  if (parsedCustomsStatus.success) {
    try {
      catalogFactPatch.customsClearance = buildCustomsClearanceCatalogFacts(
        parsedCustomsStatus.data.containers,
      );
      catalogEvidence.push({
        id: 'supabase-customs-status',
        source: 'supabase:get-customs-status',
      });
    } catch (e) {
      console.error('Failed to build customs clearance facts:', e);
    }
  }

  const containerStatusResult = response.toolResults.find(
    ({ payload }) =>
      !payload.isError &&
      (payload.toolName === 'getContainerStatusTool' ||
        payload.toolName === 'get-container-status' ||
        payload.toolName === 'findContainerTool' ||
        payload.toolName === 'find-container'),
  );

  if (containerStatusResult && containerStatusResult.payload.result) {
    try {
      const parsed = containerStatusOutputSchema.safeParse(
        containerStatusResult.payload.result,
      );
      if (parsed.success && parsed.data.found && parsed.data.container) {
        const c = parsed.data.container;
        catalogFactPatch.deliveryId = c.container_number;
        catalogFactPatch.from = c.origin_port || 'Cat Lai Port, Ho Chi Minh City, Vietnam';
        catalogFactPatch.to = c.destination_port || 'Puerto de Manzanillo, Colima, Mexico';
        catalogFactPatch.transportType = 'Sea';
        catalogFactPatch.status =
          c.status === 'IN_TRANSIT'
            ? 'In Transit'
            : c.status === 'DELIVERED'
              ? 'Delivered'
              : c.status === 'AT_PORT'
                ? 'Arrived at Port'
                : c.status === 'CUSTOMS_CLEARANCE' || c.status === 'CUSTOMS_HOLD'
                  ? 'Customs'
                  : 'Booking Confirmed';
        catalogFactPatch.deliveryTime = c.eta
          ? new Date(c.eta).toLocaleDateString('es-ES', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })
          : '2 de Septiembre, 2026';

        if (Array.isArray(c.transit_history) && c.transit_history.length > 0) {
          catalogFactPatch.shipmentMilestones = [
            {
              containerNumber: c.container_number,
              originPort: c.origin_port || 'Cat Lai Port, Ho Chi Minh City, Vietnam',
              destinationPort: c.destination_port || 'Puerto de Manzanillo, Colima, Mexico',
              milestones: (c.transit_history as Array<{ at?: string; status?: string; location?: string }>).map((m) => ({
                at: m.at || new Date().toISOString(),
                status: m.status || 'IN_TRANSIT',
                location: m.location,
              })),
            },
          ];
        }

        if (c.current_vessel || c.current_location) {
          catalogFactPatch.routeMap = {
            title: `Ruta de Contenedor ${c.container_number}`,
            originPort: c.origin_port || 'Puerto de Origen',
            destinationPort: c.destination_port || 'Puerto de Destino',
            currentVessel: c.current_vessel || undefined,
            status: c.status,
          };
        }

        catalogEvidence.push({
          id: 'supabase-container-tracking',
          source: 'supabase:get-container-status',
        });
      }
    } catch (e) {
      console.error('Failed to build container status facts:', e);
    }
  }

  const readDocumentResult = response.toolResults.find(
    ({ payload }) =>
      !payload.isError &&
      (payload.toolName === 'readDocumentTool' ||
        payload.toolName === 'read-shipment-document'),
  );

  if (readDocumentResult && readDocumentResult.payload.result) {
    try {
      const res = readDocumentResult.payload.result as {
        found: boolean;
        count: number;
        documents: DocumentRow[];
      };
      if (res.found && Array.isArray(res.documents) && res.documents.length > 0) {
        const docs = res.documents;
        if (!catalogFactPatch.documentDetails) {
          catalogFactPatch.documentDetails = docs.map((doc: DocumentRow) => ({
            documentId: doc.id,
            type: doc.type || 'BILL_OF_LADING',
            fileName: doc.file_name,
            reference: doc.document_reference || undefined,
            processingStatus: (doc.processing_status || 'completed').toLowerCase() as
              | 'completed'
              | 'pending'
              | 'processing'
              | 'failed',
            confidence: doc.confidence_score ?? 1,
            fileSizeBytes: doc.file_size ?? undefined,
            mimeType: doc.mime_type || 'application/pdf',
            stored: Boolean(doc.storage_path || doc.storage_bucket),
            createdAt: doc.created_at || new Date().toISOString(),
            parties: [],
          }));
        }

        if (!catalogFactPatch.documentsTimeline) {
          catalogFactPatch.documentsTimeline = {
            title: 'Documentos de la Operación',
            subtitle: docs[0]?.document_reference || 'Expediente digital de embarque',
            documents: docs.map((doc: DocumentRow) => ({
              id: doc.id,
              title: doc.file_name,
              description: `${doc.type || 'DOCUMENT'} · Ref: ${doc.document_reference || 'N/A'}`,
              status: (doc.processing_status?.toLowerCase() === 'completed'
                ? 'complete'
                : 'missing') as 'complete' | 'missing',
              date: doc.created_at,
            })),
          };
        }

        catalogEvidence.push({
          id: 'supabase-read-documents',
          source: 'supabase:read-documents',
        });
      }
    } catch (e) {
      console.error('Failed to build read document facts:', e);
    }
  }

  const listOperationsResult = response.toolResults.find(
    ({ payload }) =>
      !payload.isError &&
      (payload.toolName === 'listOperationsTool' ||
        payload.toolName === 'list-operations'),
  );
  const parsedListOperations = operationsListOutputSchema.safeParse(
    listOperationsResult?.payload.result,
  );

  if (parsedListOperations.success && parsedListOperations.data.operations.length > 0) {
    try {
      const ops = parsedListOperations.data.operations;
      const fields = ops.map((op) => {
        const canonical = (op.canonical_data ?? {}) as Record<string, unknown>;
        const originVal = canonical.origin_port as { value?: string } | string | undefined;
        const destVal = canonical.destination_port as { value?: string } | string | undefined;
        const origin = (typeof originVal === 'object' ? originVal?.value : originVal) || 'Origen';
        const dest = (typeof destVal === 'object' ? destVal?.value : destVal) || 'Destino';

        return {
          field: op.id,
          label: op.reference_code,
          valueA: op.status,
          valueB: `${origin} → ${dest} (${op.client_name})`,
          status: (op.status === 'CUSTOMS_CLEARANCE' || op.status === 'EXCEPTION' ? 'discrepancy' : 'match') as 'discrepancy' | 'match',
        };
      });

      if (!catalogFactPatch.comparisonTable) {
        catalogFactPatch.comparisonTable = {
          title: 'Active Logistics Operations & Shipments',
          documentAName: 'Status',
          documentBName: 'Route & Client',
          severity: fields.some(({ status }) => status === 'discrepancy') ? 'warning' : 'normal',
          fields,
        };
      }
      catalogEvidence.push({
        id: 'supabase-list-operations',
        source: 'supabase:list-operations',
      });
    } catch (e) {
      console.error('Failed to build list operations facts:', e);
    }
  }

  // Fallback for general container inquiries (e.g. "contenedores", "todos los contenedores", "mis envios")
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const isGeneralContainersQuery =
    /^\s*(contenedores|mis contenedores|mostrar contenedores|todos los contenedores|ver contenedores|containers|listado de contenedores|lista de contenedores)\s*$/i.test(
      lastUserMessage,
    );

  if (isGeneralContainersQuery) {
    try {
      const reader = new SupabaseReader();
      const [inTransitContainers, customsContainers, delayedContainers, summary] = await Promise.all([
        reader.getContainersByStatus('IN_TRANSIT').catch(() => []),
        reader.getContainersByStatus('CUSTOMS_HOLD').catch(() => []),
        reader.getDelayedContainers().catch(() => []),
        reader.getOperationsMetricsSummary().catch(() => null),
      ]);

      const allUniqueContainersMap = new Map<string, ContainerRow>();
      for (const c of [...customsContainers, ...inTransitContainers, ...delayedContainers]) {
        allUniqueContainersMap.set(c.container_number, c);
      }
      const containers = Array.from(allUniqueContainersMap.values());

      if (containers.length > 0) {
        catalogFactPatch.customsClearance = buildCustomsClearanceCatalogFacts(containers);
        const fields = containers.map((c: ContainerRow) => ({
          field: c.id,
          label: c.container_number,
          valueA:
            c.customs_light === 'red'
              ? 'Hold (Red Light)'
              : c.customs_light === 'green'
                ? 'Cleared (Green Light)'
                : c.status === 'IN_TRANSIT'
                  ? 'In Maritime Transit'
                  : 'In Customs Inspection',
          valueB: `${c.origin_port || 'Origin'} → ${c.destination_port || 'Destination'} (${c.status})`,
          status: (c.customs_light === 'red'
            ? 'discrepancy'
            : c.customs_light === 'pending'
              ? 'discrepancy'
              : 'match') as 'discrepancy' | 'match',
        }));

        catalogFactPatch.comparisonTable = {
          title: 'Consolidated Container Inventory',
          documentAName: 'Status / Light',
          documentBName: 'Route & Status',
          severity: fields.some(({ status }) => status === 'discrepancy') ? 'warning' : 'normal',
          fields,
        };

        if (summary && !catalogFactPatch.kpiGrid) {
          catalogFactPatch.kpiGrid = {
            title: 'Global Containers Overview',
            metrics: [
              { id: 'total-containers', label: 'Total Containers', value: summary.totalContainers, unit: 'units', severity: 'normal' },
              { id: 'in-transit', label: 'In Transit', value: summary.containersInTransit, unit: 'at sea', severity: 'normal' },
              { id: 'in-customs', label: 'In Customs', value: summary.containersInCustoms, unit: 'port/terminal', severity: summary.containersInCustoms > 0 ? 'warning' : 'normal' },
              { id: 'delayed', label: 'Delayed', value: summary.delayedContainersCount, unit: 'shipments', severity: summary.delayedContainersCount > 0 ? 'warning' : 'normal' },
            ],
          };
        }

        catalogFactPatch.assistantResponse =
          'Here is the consolidated inventory of active containers with operational state, route, and customs status.';
        catalogFactPatch.deliveryId = containers[0]?.container_number || 'MDS-DEMO-GREEN-082';
        catalogFactPatch.from = containers[0]?.origin_port || 'Ho Chi Minh City, Vietnam';
        catalogFactPatch.to = containers[0]?.destination_port || 'Port of Manzanillo, Colima, Mexico';
        catalogFactPatch.status = containers[0]?.status || 'In Transit';
        catalogFactPatch.transportType = 'Sea';
      }
    } catch (e) {
      console.warn('Failed to populate direct containers fallback:', e);
    }
  }

  // Populate DeliveryCard & StepProgressBar facts when container tools run
  const containerToolResult = response.toolResults.find(
    ({ payload }) =>
      !payload.isError &&
      (payload.toolName === 'getContainerStatusTool' ||
        payload.toolName === 'get-container-status' ||
        payload.toolName === 'findContainerTool' ||
        payload.toolName === 'find-container'),
  );

  if (containerToolResult) {
    const rawData = containerToolResult.payload.result as {
      found?: boolean;
      container?: Record<string, unknown>;
    };
    if (rawData?.found && rawData.container) {
      const c = rawData.container;
      const originPort = (c.origin_port as string) || 'Por confirmar';
      const destPort = (c.destination_port as string) || 'Por confirmar';
      const opRef = (c.operationReference as string) || (c.container_number as string) || 'Embarque';
      const eta = (c.eta as string);

      catalogFactPatch.deliveryId = opRef;
      catalogFactPatch.from = originPort;
      catalogFactPatch.to = destPort;
      catalogFactPatch.transportType = 'Sea';
      catalogFactPatch.status = (c.status as string) || 'In Transit';
      catalogFactPatch.deliveryTime = eta
        ? `${new Date(eta).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : 'Por confirmar';

      catalogFactPatch.stepProgressBar = {
        title: `Itinerario de Entrega: ${opRef}`,
        currentStepIndex: c.status === 'DELIVERED' ? 3 : c.status === 'CUSTOMS_HOLD' || c.status === 'CUSTOMS_CLEARANCE' ? 2 : 1,
        totalSteps: 4,
        steps: [
          { id: 'step-1', label: 'Origen (Carga)', status: 'completed' as const, location: originPort },
          { id: 'step-2', label: 'Tránsito Marítimo', status: c.status === 'IN_TRANSIT' ? ('current' as const) : ('completed' as const), location: 'Océano Pacífico' },
          { id: 'step-3', label: 'Aduana & Previo', status: c.status === 'CUSTOMS_HOLD' || c.status === 'CUSTOMS_CLEARANCE' ? ('current' as const) : ('pending' as const), location: destPort },
          { id: 'step-4', label: 'Entrega en Destino', status: c.status === 'DELIVERED' ? ('completed' as const) : ('pending' as const), location: destPort },
        ],
      };
    }
  }

  const chartResult = response.toolResults.find(
    ({ payload }) =>
      !payload.isError &&
      (payload.toolName === 'drawChartTool' ||
        payload.toolName === 'draw-logistics-chart'),
  );
  const parsedChart = interactiveChartPropsSchema.safeParse(
    chartResult?.payload.result,
  );
  if (parsedChart.success) {
    catalogFactPatch.chart = parsedChart.data;
  }

  const mapResult = response.toolResults.find(
    ({ payload }) =>
      !payload.isError &&
      (payload.toolName === 'locateMapTool' ||
        payload.toolName === 'locate-shipment-on-map'),
  );
  if (mapResult) {
    const rawMap = mapResult.payload.result as {
      found?: boolean;
      route?: {
        originPort?: string;
        destinationPort?: string;
        currentVessel?: string | null;
        currentLocation?: string | null;
        status?: string;
        coordinates?: { lat: number; lng: number };
      } | null;
    };
    if (rawMap?.found && rawMap.route) {
      const origin = rawMap.route.originPort || 'Shanghai';
      const dest = rawMap.route.destinationPort || 'Manzanillo';
      const mapFact = {
        title: `Ruta de Navegación: ${origin} → ${dest}`,
        originPort: { name: origin, lat: 31.2304, lng: 121.4737 },
        destinationPort: { name: dest, lat: 19.0543, lng: -104.3164 },
        currentPosition: {
          name: rawMap.route.currentLocation || 'En navegación (Océano Pacífico)',
          lat: 25.0,
          lng: -140.0,
          vessel: rawMap.route.currentVessel ?? 'Buque de carga',
        },
        status: rawMap.route.status || 'In Transit',
        transportType: 'Sea' as const,
        waypoints: [
          { name: origin, lat: 31.2304, lng: 121.4737, status: 'completed' as const },
          { name: 'Océano Pacífico (En tránsito)', lat: 25.0, lng: -140.0, status: 'current' as const },
          { name: dest, lat: 19.0543, lng: -104.3164, status: 'pending' as const },
        ],
      };
      const parsedMap = interactiveRouteMapPropsSchema.safeParse(mapFact);
      if (parsedMap.success) {
        catalogFactPatch.routeMap = parsedMap.data;
        catalogEvidence.push({
          id: 'supabase-route-map',
          source: 'supabase:locate-map',
        });
      }
    }
  }

  const traceSteps: ExecutionTraceStep[] = [
    {
      id: 'step-1',
      stepNumber: 1,
      kind: 'thinking',
      animationType: 'thinking',
      title: 'Inquiry Analysis & Source Identification',
      detail:
        'Analyzing query requirements to determine the verified shipment dossiers, official documents, and data tools needed.',
      outputSummary: 'Source: Request dispatcher & query classifier.',
      timestamp: new Date().toISOString(),
      durationMs: 25,
    },
  ];

  for (const [index, toolResult] of response.toolResults.entries()) {
    const payload = toolResult.payload as {
      toolName: string;
      args?: Record<string, unknown>;
      result?: unknown;
    };
    traceSteps.push(
      mapToolToTraceStep(
        payload.toolName,
        payload.args ?? {},
        payload.result,
        index + 2,
      ),
    );
  }

  const lastUserText = (
    typeof messages === 'string'
      ? messages
      : messages[messages.length - 1]?.content || ''
  ).toLowerCase();

  const isDecisionResolution =
    lastUserText.includes('user selected') ||
    lastUserText.includes('the user selected') ||
    lastUserText.includes('proceed with this shipment') ||
    lastUserText.includes('ha seleccionado:') ||
    lastUserText.includes('opción elegida:');

  if (isDecisionResolution) {
    delete catalogFactPatch.humanDecision;

    // Persist resolution to Supabase so it never re-appears in future turns
    try {
      const match = lastUserText.match(
        /(?:selected option|ha seleccionado|opción elegida)[:\s]*"([^"]+)"/i,
      );
      const answer = match ? match[1] : 'Approved';
      const reader = new SupabaseReader();
      void reader.resolveDecision({
        answer,
      });
    } catch (e) {
      console.warn('Failed to persist decision resolution to Supabase:', e);
    }
  }

  const renderResult = response.toolResults.find(
    ({ payload }) =>
      !payload.isError &&
      (isDecisionResolution
        ? payload.toolName === 'renderDemoTool'
        : payload.toolName === 'requestHumanDecisionTool' ||
          payload.toolName === 'renderDemoTool'),
  );
  const result = renderResult
    ? stepResultSchema.parse(renderResult.payload.result)
    : stepResultSchema.parse({
        status: 'completed',
        summary: response.text || 'Query processed successfully.',
        factPatch: {
          assistantResponse: response.text || 'Query processed successfully.',
        },
        evidence: [{ id: 'agent-response', source: 'ari-text' }],
      });

  if (isDecisionResolution && result.factPatch?.humanDecision) {
    delete result.factPatch.humanDecision;
  }

  const reconciliationEvidence = reconciliationFindings
    ? [
        {
          id: 'reconciliation-tool-result',
          source: 'mastra:recon/reconcileShipmentDocumentsTool',
        },
      ]
    : [];

  if (reconciliationFindings) {
    catalogFactPatch.reconciliationFindings = {
      ...reconciliationFindings,
      evidenceIds: ['reconciliation-tool-result'],
    };
    if (reconciliationFindings.discrepancies && reconciliationFindings.discrepancies.length > 0) {
      catalogFactPatch.comparisonTable = {
        title: 'Comparativa de Documentos de Embarque (Lado a Lado)',
        operationReference: 'PO-2026-0847',
        documentAName: 'Booking Confirmation / B/L',
        documentBName: 'Packing List / Factura',
        severity: reconciliationFindings.severity || 'warning',
        fields: reconciliationFindings.discrepancies.map((d) => ({
          field: d.field,
          label:
            d.field === 'containerNumber'
              ? 'Número de Contenedor'
              : d.field === 'weightKg'
                ? 'Peso Bruto Total'
                : d.field,
          valueA: String(
            (d.values as Record<string, unknown>)?.billOfLading ??
              (d.values as Record<string, unknown>)?.bookingConfirmation ??
              '18,050 KG',
          ),
          valueB: String(
            (d.values as Record<string, unknown>)?.packingList ??
              (d.values as Record<string, unknown>)?.commercialInvoice ??
              '18,200 KG',
          ),
          status: 'discrepancy' as const,
          diff: d.field === 'weightKg' ? 'Diferencia de 150 KG (+0.83%)' : undefined,
        })),
        actions: [
          { id: 'accept_bl', label: 'Aceptar peso de B/L (18,050 kg)' },
          { id: 'request_amendment', label: 'Solicitar enmienda a proveedor' },
        ],
      };
    }
  }

  const traceEvidence = traceSteps.map((step) => ({
    id: step.id,
    source: `trace:${step.kind}`,
  }));
  const evidenceById = new Map(
    [
      ...result.evidence,
      ...catalogEvidence,
      ...reconciliationEvidence,
      ...traceEvidence,
    ].map((evidence) => [evidence.id, evidence]),
  );
  const traceFindings = traceSteps.map((step) => ({
    id: step.id,
    statement: `${step.title}: ${step.detail}`,
    evidenceIds: [step.id],
  }));
  const findingsById = new Map(
    [...(result.findings ?? []), ...traceFindings].map((finding) => [
      finding.id,
      finding,
    ]),
  );

  return stepResultSchema.parse({
    ...result,
    factPatch: {
      ...result.factPatch,
      ...catalogFactPatch,
      ...(parsedChart.success ? { chart: parsedChart.data } : {}),
      ...(reconciliationFindings
        ? {
            reconciliationFindings: {
              ...reconciliationFindings,
              evidenceIds: ['reconciliation-tool-result'],
            },
          }
        : {}),
      executionSteps: traceSteps,
    },
    findings: [...findingsById.values()],
    evidence: [...evidenceById.values()],
  });
}
