import { composeRunUi } from '../../backend/src/services/ui-composer.js';
import type { StepResult } from '../../backend/src/contracts/step-result.js';
import uiIntentsData from '../datasets/ui_intents.json' with { type: 'json' };

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

  for (const intent of uiIntentsData.intents) {
    intentOutcomes[intent.id] = [];

    for (let runIndex = 1; runIndex <= runsPerIntent; runIndex++) {
      const stepResult: StepResult = {
        status: 'completed',
        summary: `Respuesta visual generada para ${intent.focus}`,
        factPatch: {
          assistantResponse: `Procesada solicitud sobre ${intent.focus}`,
          ...intent.facts,
        },
        evidence: [{ id: 'eval-evidence', source: 'eval:ui-generation' }],
      };

      const t0 = performance.now();
      const rawSpec = composeRunUi(stepResult) as {
        root: string;
        elements: Record<string, { type: string; children?: string[]; props?: unknown }>;
      };
      const latencyMs = Math.round((performance.now() - t0) * 100) / 100;
      latencies.push(latencyMs);

      // Validate structural integrity
      const hasRoot = Boolean(rawSpec && rawSpec.root && rawSpec.elements && rawSpec.elements[rawSpec.root]);
      const elementKeys = new Set(Object.keys(rawSpec?.elements || {}));
      let hasOrphanChildren = false;
      let allComponentsInCatalog = true;
      const composedTypes: string[] = [];

      if (rawSpec && rawSpec.elements) {
        for (const el of Object.values(rawSpec.elements)) {
          composedTypes.push(el.type);
          if (!REGISTERED_CATALOG_COMPONENTS.has(el.type) && el.type !== 'Card' && el.type !== 'Text') {
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

      // Check if expected components are present
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

  // Latency metrics
  latencies.sort((a, b) => a - b);
  const minMs = latencies[0] || 0;
  const maxMs = latencies[latencies.length - 1] || 0;
  const avgMs = Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 100) / 100;
  const medianMs = latencies[Math.floor(latencies.length / 2)] || 0;

  return {
    totalRuns: allRuns.length,
    totalIntents: uiIntentsData.intents.length,
    structuralValidityRate,
    catalogComplianceRate,
    componentSelectionStability,
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
