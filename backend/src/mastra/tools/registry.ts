import { createReconcileShipmentDocumentsTool } from './reconcile-shipment-documents.tool.js';
import { createRenderDemoTool } from './render-demo.tool.js';

interface ToolRegistryOptions {
  onRenderDemoExecution?: () => void;
}

export function createToolRegistry(options: ToolRegistryOptions = {}) {
  return {
    reconcileShipmentDocumentsTool: createReconcileShipmentDocumentsTool(),
    renderDemoTool: createRenderDemoTool({
      onExecution: options.onRenderDemoExecution,
    }),
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
