import type { ExecutionTraceStep } from './work-trace.js';

export {
  executionStepKindSchema,
  executionTraceStepSchema,
  thinkingAnimationTypeSchema,
  type ExecutionTraceStep,
  type ThinkingAnimationType,
} from './work-trace.js';

/**
 * Helper to safely extract string properties from unknown result objects
 */
function getProp(obj: unknown, path: string[]): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  let current: any = obj;
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[key];
  }
  return typeof current === 'string' || typeof current === 'number' ? String(current) : undefined;
}

/**
 * Helper to map tool names to rich, context-aware, 100% intuitive, non-technical explanations.
 */
export function mapToolToTraceStep(
  toolName: string,
  args: Record<string, unknown> = {},
  result: unknown = null,
  stepNumber: number = 1,
): ExecutionTraceStep {
  return {
    ...createMappedTraceStep(toolName, args, result, stepNumber),
    input: args,
  };
}

export function mapToolToTraceStart(
  toolName: string,
  args: Record<string, unknown> = {},
  stepNumber = 1,
): ExecutionTraceStep {
  const mapped = createMappedTraceStep(toolName, args, null, stepNumber);
  const detailByKind: Record<ExecutionTraceStep['kind'], string> = {
    thinking: 'Preparing the next logistics step.',
    reading_document: 'Reading the shipment documents needed for this response.',
    drawing_chart: 'Preparing a clear view of the available logistics data.',
    locating_map: 'Checking the available route and position.',
    finding_container: 'Locating the shipment in the available records.',
    calculating_eta: 'Calculating the estimated arrival from the available shipment data.',
    comparing_data: 'Comparing the available shipment information.',
    querying_database: 'Reviewing the available operation details.',
    requesting_decision: 'Preparing the options that need your decision.',
    generating_ui: 'Preparing the shipment summary.',
  };

  return {
    ...mapped,
    status: 'running',
    detail: detailByKind[mapped.kind],
    outputSummary: undefined,
    input: args,
  };
}

function createMappedTraceStep(
  toolName: string,
  args: Record<string, unknown> = {},
  result: unknown = null,
  stepNumber: number = 1,
): ExecutionTraceStep {
  const id = `step-${stepNumber}-${toolName}`;
  const timestamp = new Date().toISOString();

  switch (toolName) {
    case 'read-shipment-document':
    case 'readDocumentTool': {
      const docType = String(args.documentType || args.documentIdOrRef || 'shipment document');
      return {
        id,
        stepNumber,
        kind: 'reading_document',
        animationType: 'reading',
        title: 'Reading shipment document',
        detail: `I read the ${docType} and checked quantities, declared weight, and required customs information.`,
        toolName,
        outputSummary: 'Shipment document details checked.',
        timestamp,
        durationMs: 45,
      };
    }

    case 'draw-logistics-chart':
    case 'drawChartTool': {
      return {
        id,
        stepNumber,
        kind: 'drawing_chart',
        animationType: 'drawing',
        title: 'Preparing logistics chart',
        detail:
          'I organized the available shipment metrics into a clear chart.',
        toolName,
        outputSummary: 'Logistics chart prepared.',
        timestamp,
        durationMs: 30,
      };
    }

    case 'locate-shipment-on-map':
    case 'locateMapTool': {
      const ref = String(args.referenceOrContainer || 'your shipment');

      return {
        id,
        stepNumber,
        kind: 'locating_map',
        animationType: 'mapping',
        title: 'Locating shipment',
        detail: `I checked the route, maritime coordinates, and available position for ${ref}.`,
        toolName,
        outputSummary: 'Shipment route and coordinates located.',
        timestamp,
        durationMs: 50,
      };
    }

    case 'find-container':
    case 'findContainerTool':
    case 'get-container-status':
    case 'getContainerStatusTool': {
      const containerNo = String(args.containerNumber || args.containerQuery || 'your container');
      const vessel = getProp(result, ['container', 'current_vessel']);
      const location = getProp(result, ['container', 'current_location']);
      const status = getProp(result, ['container', 'status']);
      const dest = getProp(result, ['container', 'destination_port']);

      let detail = `I tracked container ${containerNo} in the shipment records.`;
      if (vessel || location) {
        detail = `I located container ${containerNo} and confirmed its assigned transport and current position${dest ? ' along with its recorded destination' : ''}.`;
      }

      return {
        id,
        stepNumber,
        kind: 'finding_container',
        animationType: 'findingBoat',
        title: 'Locating container',
        detail,
        toolName,
        outputSummary: status ? `Status: ${status}` : 'Container located.',
        timestamp,
        durationMs: 40,
      };
    }

    case 'search-cargo-items':
    case 'searchCargoTool': {
      const query = String(args.query || 'your cargo');
      const count = getProp(result, ['matchedCount']) || '1';
      return {
        id,
        stepNumber,
        kind: 'finding_container',
        animationType: 'finding',
        title: 'Locating cargo',
        detail: `I checked the cargo manifests for "${query}" and found ${count} matching shipment(s).`,
        toolName,
        outputSummary: `Matching shipments found for "${query}".`,
        timestamp,
        durationMs: 55,
      };
    }

    case 'calculate-shipment-eta':
    case 'calculateEtaTool': {
      const ref = String(args.referenceOrContainer || 'your shipment');
      const delayDays = getProp(result, ['etaAnalysis', 'delayDays']);
      const hasDelay = getProp(result, ['etaAnalysis', 'hasDelay']) === 'true';

      let detail = `I calculated sailing and port unloading times for ${ref}.`;
      if (hasDelay && delayDays) {
        detail += ` The estimated arrival is ${delayDays} day(s) later than the original date.`;
      } else {
        detail += ' The shipment remains on its planned schedule.';
      }

      return {
        id,
        stepNumber,
        kind: 'calculating_eta',
        animationType: 'eta',
        title: 'Calculating arrival time',
        detail,
        toolName,
        outputSummary: hasDelay ? `Delay: ${delayDays} day(s)` : 'Shipment remains on schedule.',
        timestamp,
        durationMs: 35,
      };
    }

    case 'compare-shipment-data':
    case 'compareDataTool':
    case 'reconcile-shipment-documents':
    case 'reconcileShipmentDocumentsTool': {
      const discrepanciesCount = getProp(result, ['discrepanciesCount']);
      const isClean = discrepanciesCount === '0' || getProp(result, ['status']) === 'matched';
      return {
        id,
        stepNumber,
        kind: 'comparing_data',
        animationType: 'comparing',
        title: 'Comparing shipment documents',
        detail: isClean
          ? 'I compared the Bill of Lading, Commercial Invoice, and Packing List. Weights, packages, and serial numbers match.'
          : `I compared the shipment documents and found ${discrepanciesCount || 'some'} weight or quantity differences that need review.`,
        toolName,
        outputSummary: isClean ? 'Shipment documents match.' : 'Shipment document differences found.',
        timestamp,
        durationMs: 60,
      };
    }

    case 'get-customs-status':
    case 'getCustomsStatusTool': {
      return {
        id,
        stepNumber,
        kind: 'querying_database',
        animationType: 'thinking',
        title: 'Checking customs status',
        detail: 'I checked the customs clearance status to confirm whether the cargo is released or needs inspection.',
        toolName,
        outputSummary: 'Customs status checked.',
        timestamp,
        durationMs: 35,
      };
    }

    case 'get-operational-alerts':
    case 'getOperationalAlertsTool': {
      const count = getProp(result, ['count']) || '0';
      return {
        id,
        stepNumber,
        kind: 'querying_database',
        animationType: 'thinking',
        title: 'Checking operation alerts',
        detail: `I checked for port congestion, weather delays, and carrier notices. ${count} alert(s) are active.`,
        toolName,
        outputSummary: 'Operation risks checked.',
        timestamp,
        durationMs: 30,
      };
    }

    case 'get-operation-details':
    case 'getOperationDetailsTool': {
      const ref = String(args.operationIdOrRef || args.referenceCode || 'your operation');
      const status = getProp(result, ['details', 'operation', 'status']);
      return {
        id,
        stepNumber,
        kind: 'querying_database',
        animationType: 'thinking',
        title: 'Reviewing operation file',
        detail: `I reviewed the full file for ${ref} and confirmed its assigned containers, event history, and shipment documents.`,
        toolName,
        outputSummary: status ? `Operation: ${status}` : 'Operation file reviewed.',
        timestamp,
        durationMs: 40,
      };
    }

    case 'get-operations-summary':
    case 'getOperationsSummaryTool':
    case 'universal-logistics-search':
    case 'universalSearchTool': {
      return {
        id,
        stepNumber,
        kind: 'querying_database',
        animationType: 'thinking',
        title: 'Reviewing logistics overview',
        detail: 'I reviewed active imports, containers in transit, and customs clearances.',
        toolName,
        outputSummary: 'Logistics overview updated.',
        timestamp,
        durationMs: 40,
      };
    }

    case 'get-pending-decisions':
    case 'getPendingDecisionsTool':
    case 'request-human-decision':
    case 'requestHumanDecisionTool': {
      const title = String(args.title || 'Approval required');
      return {
        id,
        stepNumber,
        kind: 'requesting_decision',
        animationType: 'thinking',
        title: 'Requesting your decision',
        detail: `I prepared clear options for "${title}" so you can choose the next action.`,
        toolName,
        outputSummary: 'Decision options are ready.',
        timestamp,
        durationMs: 25,
      };
    }

    case 'render-json-demo':
    case 'renderDemoTool': {
      const deliveryId = String(args.deliveryId || 'your shipment');
      return {
        id,
        stepNumber,
        kind: 'generating_ui',
        animationType: 'thinking',
        title: 'Preparing shipment summary',
        detail: `I prepared the summary for ${deliveryId} with its route, estimated arrival, and current progress.`,
        toolName,
        outputSummary: 'Shipment summary prepared.',
        timestamp,
        durationMs: 25,
      };
    }

    case 'ingest-uploaded-document':
    case 'ingestDocumentTool': {
      const fileName = String(args.fileName || 'uploaded file');
      return {
        id,
        stepNumber,
        kind: 'reading_document',
        animationType: 'reading',
        title: 'Reading uploaded document',
        detail: `I read "${fileName}", extracted its shipment details, and added them to the operation record.`,
        toolName,
        outputSummary: 'Shipment document added to the operation.',
        timestamp,
        durationMs: 65,
      };
    }

    default:
      return {
        id,
        stepNumber,
        kind: 'thinking',
        animationType: 'thinking',
        title: 'Preparing response',
        detail: 'Preparing the next logistics steps.',
        toolName,
        timestamp,
        durationMs: 20,
      };
  }
}
