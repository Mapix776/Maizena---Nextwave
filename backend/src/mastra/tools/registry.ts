import { createRequestHumanDecisionTool } from './human-decision.tool.js';
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
import { createReconcileShipmentDocumentsTool } from './reconcile-shipment-documents.tool.js';
import { createRenderDemoTool } from './render-demo.tool.js';
import { SupabaseReader } from '../../services/supabase-reader.js';

interface ToolRegistryOptions {
  onRenderDemoExecution?: () => void;
  reader?: SupabaseReader;
}

export function createToolRegistry(options: ToolRegistryOptions = {}) {
  const reader = options.reader ?? new SupabaseReader();
  return {
    reconcileShipmentDocumentsTool: createReconcileShipmentDocumentsTool(),
    renderDemoTool: createRenderDemoTool({
      onExecution: options.onRenderDemoExecution,
    }),
    requestHumanDecisionTool: createRequestHumanDecisionTool(),
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
