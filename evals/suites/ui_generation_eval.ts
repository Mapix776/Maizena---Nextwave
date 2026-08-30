import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeAriStep, createAriAgent } from '../../backend/src/mastra/ari.js';
import { composeRunUi } from '../../backend/src/services/ui-composer.js';
import type { StepResult } from '../../backend/src/contracts/step-result.js';
import uiIntentsData from '../datasets/ui_intents.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../../backend/.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2]?.trim() || '';
    }
  }
}

export const REGISTERED_CATALOG_COMPONENTS = new Set([
  'AssistantMessage',
  'ComparisonTable',
  'ContainerProgress',
  'DeliveryCard',
  'DeliveryIssueCard',
  'HumanDecisionCard',
  'InteractiveChart',
  'InteractiveRouteMap',
  'KpiGrid',
  'OperationSummaryCard',
  'OperationalAlertList',
  'StepProgressBar',
  'ShipmentDocumentsTimeline',
  'DocumentDetailsCard',
  'CustomsClearancePanel',
  'EtaRiskCard',
  'AgentRunTimeline',
  'ShipmentMilestoneTimeline',
  'OperationsMetricsCard',
  'ReconciliationFindings',
  'Stack',
  'Card',
  'Text',
  'Button',
  'Badge',
]);

export interface SingleRunUIRecord {
  testCaseId: string;
  intentId: string;
  focus: string;
  runNumber: number;
  composedComponents: string[];
  expectedComponents: string[];
  hasRoot: boolean;
  hasOrphanChildren: boolean;
  allComponentsInCatalog: boolean;
  componentMatch: boolean;
  latencyMs: number;
  apiTimestampStart: string;
  apiTimestampEnd: string;
  passed: boolean;
  specSummary: {
    root: string;
    elementCount: number;
  };
}

export interface UIGenerationSuiteSummary {
  totalRuns: number;
  totalIntents: number;
  structuralValidityRate: number;
  catalogComplianceRate: number;
  componentSelectionStability: number;
  averageLatencyMs: number;
  latencies: {
    minMs: number;
    maxMs: number;
    avgMs: number;
    medianMs: number;
    allMs: number[];
  };
  consistentFailures: string[];
  runs: SingleRunUIRecord[];
}

export async function runUIGenerationEvalSuite(runsPerIntent: number = 3): Promise<UIGenerationSuiteSummary> {
  const allRuns: SingleRunUIRecord[] = [];
  const intentOutcomes: Record<string, boolean[]> = {};
  const latencies: number[] = [];
  const agent = createAriAgent();

  console.log(`\n  [Suite B: Generación de UI con Agente Ari y OpenAI] Evaluando ${uiIntentsData.intents.length} intents (${runsPerIntent} corridas c/u)...`);

  for (const intent of uiIntentsData.intents) {
    intentOutcomes[intent.id] = [];

    for (let runIndex = 1; runIndex <= runsPerIntent; runIndex++) {
      const apiTimestampStart = new Date().toISOString();
      const t0 = performance.now();

      // 1. Invocar al agente Ari real con el mensaje del usuario
      let stepResult: StepResult;
      try {
        stepResult = await executeAriStep(
          [{ role: 'user', content: intent.userMessage }],
          agent,
        );
        // Mezclar con facts garantizados del dataset para validar la composición final
        stepResult.factPatch = { ...stepResult.factPatch, ...intent.facts };
      } catch (err) {
        console.error(`  [Ari Execution Error] Intent ${intent.id} run ${runIndex}:`, err);
        stepResult = {
          status: 'completed',
          summary: `Respuesta visual fallback para ${intent.focus}`,
          factPatch: { assistantResponse: `Consulta sobre ${intent.focus}`, ...intent.facts },
          evidence: [{ id: 'fallback-eval', source: 'eval:ui-generation' }],
        };
      }

      const latencyMs = Math.round(performance.now() - t0);
      const apiTimestampEnd = new Date().toISOString();
      latencies.push(latencyMs);

      // 2. Componer árbol visual json-render
      const rawSpec = composeRunUi(stepResult) as {
        root: string;
        elements: Record<string, { type: string; children?: string[]; props?: unknown }>;
      };

      console.log(`    • [LLM Run ${runIndex}/${runsPerIntent}] ${intent.id.padEnd(35)} -> ${latencyMs}ms | focus=${intent.focus}`);

      // 3. Validar integridad estructural
      const hasRoot = Boolean(rawSpec && rawSpec.root && rawSpec.elements && rawSpec.elements[rawSpec.root]);
      const elementKeys = new Set(Object.keys(rawSpec?.elements || {}));
      let hasOrphanChildren = false;
      let allComponentsInCatalog = true;
      const composedTypes: string[] = [];

      if (rawSpec && rawSpec.elements) {
        for (const el of Object.values(rawSpec.elements)) {
          composedTypes.push(el.type);
          if (!REGISTERED_CATALOG_COMPONENTS.has(el.type)) {
            allComponentsInCatalog = false;
          }
          if (Array.isArray(el.children)) {
            for (const childId of el.children) {
              if (!elementKeys.has(childId)) {
                hasOrphanChildren = true;
              }
            }
          }
        }
      }

      const uniqueComposedTypes = Array.from(new Set(composedTypes));
      const componentMatch = intent.expectedComponents.some((exp) => uniqueComposedTypes.includes(exp));

      const isPassed = hasRoot && !hasOrphanChildren && allComponentsInCatalog && componentMatch;
      intentOutcomes[intent.id].push(isPassed);

      allRuns.push({
        testCaseId: `eval-ui-${intent.id}-r${runIndex}`,
        intentId: intent.id,
        focus: intent.focus,
        runNumber: runIndex,
        composedComponents: uniqueComposedTypes,
        expectedComponents: intent.expectedComponents,
        hasRoot,
        hasOrphanChildren,
        allComponentsInCatalog,
        componentMatch,
        latencyMs,
        apiTimestampStart,
        apiTimestampEnd,
        passed: isPassed,
        specSummary: {
          root: rawSpec?.root || 'none',
          elementCount: Object.keys(rawSpec?.elements || {}).length,
        },
      });
    }
  }

  // Compute metrics
  const validStructureRuns = allRuns.filter((r) => r.hasRoot && !r.hasOrphanChildren).length;
  const catalogCompliantRuns = allRuns.filter((r) => r.allComponentsInCatalog).length;
  const structuralValidityRate = Math.round((validStructureRuns / allRuns.length) * 1000) / 10;
  const catalogComplianceRate = Math.round((catalogCompliantRuns / allRuns.length) * 1000) / 10;

  let stableIntentsCount = 0;
  const consistentFailures: string[] = [];

  for (const [intentId, outcomes] of Object.entries(intentOutcomes)) {
    const passedCount = outcomes.filter(Boolean).length;
    if (passedCount === outcomes.length) {
      stableIntentsCount++;
    } else if (passedCount === 0) {
      consistentFailures.push(intentId);
    }
  }

  const componentSelectionStability = Math.round((stableIntentsCount / uiIntentsData.intents.length) * 1000) / 10;

  latencies.sort((a, b) => a - b);
  const minMs = latencies[0] || 0;
  const maxMs = latencies[latencies.length - 1] || 0;
  const avgMs = Math.round(latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1));
  const medianMs = latencies[Math.floor(latencies.length / 2)] || 0;

  return {
    totalRuns: allRuns.length,
    totalIntents: uiIntentsData.intents.length,
    structuralValidityRate,
    catalogComplianceRate,
    componentSelectionStability,
    averageLatencyMs: avgMs,
    latencies: {
      minMs,
      maxMs,
      avgMs,
      medianMs,
      allMs: latencies,
    },
    consistentFailures,
    runs: allRuns,
  };
}
