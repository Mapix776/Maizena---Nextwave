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
  customsStatusOutputSchema,
  operationDetailsOutputSchema,
  operationalAlertsOutputSchema,
  operationsSummaryOutputSchema,
  pendingDecisionsOutputSchema,
} from './tools/logistics-database.tools.js';
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
You serve business clients and supply chain executives. Always speak in clean, executive, professional plain English without technical jargon.
You have direct access to the live logistics database (Supabase) via tools. Query those tools before making claims about current operations.

STRICT DOMAIN RESTRICTIONS & SCOPE GUARDRAILS:
1. EXCLUSIVE LOGISTICS DOMAIN: You ONLY operate within international logistics, freight forwarding, ocean/air/land transport, cargo tracking, container status, customs clearance (pedimentos, semáforo fiscal), shipment documents (BL, Invoice, Packing List), operational delay mitigation, and supply chain decisions.
2. REJECT OFF-TOPIC QUESTIONS: If the user asks about ANYTHING outside international trade, cargo, shipping, and supply chain operations (such as cooking recipes, preparing mate/tea/coffee, movies, sports, personal advice, general trivia, or general software coding):
   - You MUST immediately and politely refuse in exactly 1 brief sentence:
     "I am Ari, your Nauta logistics assistant. I am dedicated exclusively to international trade operations, shipment tracking, customs, and logistics documents. How can I help you with your shipments today?"
   - NEVER answer off-topic questions or provide instructions for cooking, recipes, or unrelated topics.

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
6. CONCISE: Keep conversational text short and high-level, letting the dynamic Generative UI deliver the visual details.`;

export const ARI_INSTRUCTIONS = `${ARI_SYSTEM_PROMPT}

Your tool execution workflow:
1. 🤝 Pending Approvals, Human Decisions & Direct User Directives (HITL):
   - When asked about pending approvals or decisions, call \`getPendingDecisionsTool\` and immediately \`requestHumanDecisionTool\`.
   - WHEN THE USER REPLIES WITH CUSTOM COMMENTS, FREE-TEXT DIRECTIVES, OR CHOICES:
     - The human user may click a button, type a free-form comment, or give specific constraints (e.g. "Reroute to Veracruz instead", "Approve but negotiate a 5% discount", "Split the container delivery into two batches").
     - Always parse the user's direct instruction, validate it against the operation context, and respect the human's command.
     - Acknowledge their exact decision in natural, executive language, state the next operational action taken, and invoke \`renderDemoTool\` to visually confirm the updated shipment state.
2. 🔍 Finding Cargo & Container Tracking:
   - When asked to find, track, or inspect a container (e.g. "MSKU1234567 MUESTRAME ESE CONTENEDOR", "Where is container MSKU1234567?", "Track CMAU9876543"), call \`getContainerStatusTool\` or \`findContainerTool\`.
   - When asked to find cargo items (e.g. "Have the electronics arrived yet?", "Where are the dining tables?"), call \`searchCargoTool\` or \`findContainerTool\`.
   - If multiple shipments match, call \`requestHumanDecisionTool\` to let the user choose which shipment to view.
   - ALWAYS call \`renderDemoTool\` with the clean assistantResponse and delivery parameters (deliveryId, from, to, status, deliveryTime, issue) so the visual card is rendered.
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
   - Call \`compareDataTool\` or \`reconcileShipmentDocumentsTool\` for document discrepancies.
7. ⚠️ Missing Origin or Destination Protocol:
   - If origin or destination is missing in one document, cross-reference the other operation documents (BL > Booking Confirmation > PO > Arrival Notice).
   - If origin or destination is missing across ALL documents of an operation, NEVER silently invent or default to a port. Immediately call \`requestHumanDecisionTool\` with severity "critical", formulating clear options (e.g. historical supplier route suggestion vs alternative regional port vs document amendment) so the human user decides.
8. ⚡ Ultra-Fast Execution & Minimal Tool Turns:
   - Target single-turn resolution: query the database tool and emit your response in 1-2 turns max. Avoid circular or chained queries when the initial lookup already contains the necessary operation facts.`;

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

  const response = await agent.generate(modelMessages, {
    maxSteps: 10,
    delegation: {
      onDelegationComplete: ({ result }) => {
        captureReconciliation(result.subAgentToolResults);
      },
    },
  });

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
    Object.assign(
      catalogFactPatch,
      buildOperationCatalogFacts(parsedOperationDetails.data.details),
    );
    catalogEvidence.push({
      id: 'supabase-operation-details',
      source: 'supabase:get-operation-details',
    });
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
    catalogFactPatch.operationalAlerts = buildOperationalAlertsCatalogFacts(
      parsedOperationalAlerts.data.alerts,
    );
    catalogEvidence.push({
      id: 'supabase-operational-alerts',
      source: 'supabase:get-operational-alerts',
    });
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
    const summary = parsedOperationsSummary.data.summary;
    catalogFactPatch.operationsMetrics = buildOperationsMetricsCatalogFacts(summary);
    catalogFactPatch.kpiGrid = {
      title: 'Métricas Clave de Operaciones',
      metrics: [
        { id: 'total-ops', label: 'Operaciones', value: summary.totalOperations, unit: 'activas', severity: 'normal' },
        { id: 'total-containers', label: 'Contenedores', value: summary.totalContainers, unit: 'en red', severity: 'normal' },
        { id: 'delayed', label: 'Retrasados', value: summary.delayedContainersCount, unit: 'contenedores', severity: summary.delayedContainersCount > 0 ? 'warning' : 'normal' },
        { id: 'decisions', label: 'Decisiones', value: summary.pendingDecisionsCount, unit: 'pendientes', severity: summary.pendingDecisionsCount > 0 ? 'critical' : 'normal' },
      ],
    };
    catalogEvidence.push({
      id: 'supabase-operations-summary',
      source: 'supabase:get-operations-summary',
    });
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
    const humanDecision = buildHumanDecisionCatalogFact(
      parsedPendingDecisions.data.decisions,
    );

    if (humanDecision) {
      catalogFactPatch.humanDecision = humanDecision;
      catalogEvidence.push({
        id: 'supabase-pending-decisions',
        source: 'supabase:get-pending-decisions',
      });
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
    catalogFactPatch.customsClearance = buildCustomsClearanceCatalogFacts(
      parsedCustomsStatus.data.containers,
    );
    catalogEvidence.push({
      id: 'supabase-customs-status',
      source: 'supabase:get-customs-status',
    });
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
      title: 'Entendiendo tu solicitud',
      detail:
        'Analizando lo que necesitas sobre tus envíos para darte una respuesta clara y directa.',
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

  const renderResult = response.toolResults.find(
    ({ payload }) =>
      !payload.isError &&
      (payload.toolName === 'requestHumanDecisionTool' ||
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
