import { createCalculateEtaTool } from './calculate-eta.tool.js';
import { createCompareDataTool } from './compare-data.tool.js';
import { createDrawChartTool } from './draw-chart.tool.js';
import { createFindContainerTool } from './find-container.tool.js';
import { createHumanDecisionTool, createRequestHumanDecisionTool } from './human-decision.tool.js';
import { createIngestDocumentTool } from './ingest-document.tool.js';
import { createLocateMapTool } from './locate-map.tool.js';
import {
  createGetContainerStatusTool,
  createGetCustomsStatusTool,
  createGetOperationDetailsTool,
  createGetOperationalAlertsTool,
  createGetOperationsSummaryTool,
  createGetPendingDecisionsTool,
  createListOperationsTool,
  createSearchCargoTool,
  createUniversalSearchTool,
} from './logistics-database.tools.js';
import { createReadDocumentTool } from './read-document.tool.js';
import { createReconcileShipmentDocumentsTool } from './reconcile-shipment-documents.tool.js';
import { createRenderDemoTool } from './render-demo.tool.js';
import { SupabaseReader } from '../../services/supabase-reader.js';

interface ToolRegistryOptions {
  onRenderDemoExecution?: () => void;
  onToolResolved?: (event: { toolName: string; result: unknown }) => void | Promise<void>;
  reader?: SupabaseReader;
}

export function createToolRegistry(options: ToolRegistryOptions = {}) {
  const reader = options.reader ?? new SupabaseReader();
  const rawRegistry = {
    // 1. Reading & Ingesting documents (📄 Leyendo documento / Ingesta)
    readDocumentTool: createReadDocumentTool({ reader }),
    ingestDocumentTool: createIngestDocumentTool(),
    // 2. Drawing charts (📈 Dibujando gráficas)
    drawChartTool: createDrawChartTool({ reader }),
    // 3. Locating on map (📍 Ubicando en el mapa)
    locateMapTool: createLocateMapTool({ reader }),
    // 4. Finding container (🔍 Encontrando container)
    findContainerTool: createFindContainerTool({ reader }),
    // 5. Calculating ETA (🕒 Calculando ETA)
    calculateEtaTool: createCalculateEtaTool({ reader }),
    // 6. Comparing data (🔀 Comparando datos)
    compareDataTool: createCompareDataTool({ reader }),
    reconcileShipmentDocumentsTool: createReconcileShipmentDocumentsTool(),
    // 7. Human-in-the-Loop & Generative UI
    requestHumanDecisionTool: createRequestHumanDecisionTool(),
    renderDemoTool: createRenderDemoTool({
      onExecution: options.onRenderDemoExecution,
    }),
    // 8. General Database Queries
    searchCargoTool: createSearchCargoTool({ reader }),
    getOperationDetailsTool: createGetOperationDetailsTool({ reader }),
    listOperationsTool: createListOperationsTool({ reader }),
    getContainerStatusTool: createGetContainerStatusTool({ reader }),
    getCustomsStatusTool: createGetCustomsStatusTool({ reader }),
    getOperationalAlertsTool: createGetOperationalAlertsTool({ reader }),
    getPendingDecisionsTool: createGetPendingDecisionsTool({ reader }),
    getOperationsSummaryTool: createGetOperationsSummaryTool({ reader }),
    universalSearchTool: createUniversalSearchTool({ reader }),
  };

  if (!options.onToolResolved) {
    return rawRegistry;
  }

  const wrapped = {} as Record<string, unknown>;
  for (const [name, tool] of Object.entries(rawRegistry)) {
    if (tool && typeof (tool as any).execute === 'function') {
      const originalExec = (tool as any).execute.bind(tool);
      const wrappedTool = Object.create(tool);
      wrappedTool.execute = async (...args: any[]) => {
        const result = await originalExec(...args);
        try {
          await options.onToolResolved?.({ toolName: name, result });
        } catch (err) {
          console.warn(`[timing] onToolResolved listener error for ${name}:`, err);
        }
        return result;
      };
      wrapped[name] = wrappedTool;
    } else {
      wrapped[name] = tool;
    }
  }

  return wrapped as typeof rawRegistry;
}

export type ToolRegistry = ReturnType<typeof createToolRegistry>;

export function selectTools<
  TRegistry extends Record<string, unknown>,
  const TKey extends keyof TRegistry,
>(
  registry: TRegistry,
  keys: readonly TKey[],
): Pick<TRegistry, TKey> {
  return Object.fromEntries(keys.map((key) => [key, registry[key]])) as Pick<
    TRegistry,
    TKey
  >;
}
