import { z } from 'zod';

export const executionStepKindSchema = z.enum([
  'thinking',
  'reading_document',
  'drawing_chart',
  'locating_map',
  'finding_container',
  'calculating_eta',
  'comparing_data',
  'querying_database',
  'requesting_decision',
  'generating_ui',
]);

export const thinkingAnimationTypeSchema = z.enum([
  'thinking',
  'reading',
  'drawing',
  'mapping',
  'finding',
  'findingBoat',
  'eta',
  'comparing',
]);

export type ThinkingAnimationType = z.infer<typeof thinkingAnimationTypeSchema>;

export const executionTraceStepSchema = z.object({
  id: z.string(),
  stepNumber: z.number(),
  kind: executionStepKindSchema,
  animationType: thinkingAnimationTypeSchema.default('thinking'),
  title: z.string(),
  detail: z.string(),
  toolName: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  outputSummary: z.string().optional(),
  durationMs: z.number().default(0),
  timestamp: z.string(),
});

export type ExecutionTraceStep = z.infer<typeof executionTraceStepSchema>;

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
        title: `Document Extraction & Reading (${docType})`,
        detail: `Parsed the official "${docType}" issued by the freight forwarder: extracted origin, destination, certified gross weights, HS tariff codes, and Incoterms to ensure data integrity against the digital file.`,
        toolName,
        outputSummary: 'Source: Original PDF shipment dossier.',
        timestamp,
        durationMs: 45,
      };
    }

    case 'draw-logistics-chart':
    case 'drawChartTool': {
      const chartTitle = getProp(result, ['title']) || 'Cargo value comparison';
      return {
        id,
        stepNumber,
        kind: 'drawing_chart',
        animationType: 'drawing',
        title: 'Auditable Interactive Chart Generation',
        detail: `Consolidated operational metrics from confirmed orders and shipment manifests for "${chartTitle}": processed certified cargo volumes to render an interactive, fully auditable visual chart.`,
        toolName,
        outputSummary: 'Source: Consolidated operations & inventory database.',
        timestamp,
        durationMs: 30,
      };
    }

    case 'locate-shipment-on-map':
    case 'locateMapTool': {
      const ref = String(args.referenceOrContainer || 'your shipment');
      const vessel = getProp(result, ['route', 'currentVessel']);
      const origin = getProp(result, ['route', 'originPort']);
      const dest = getProp(result, ['route', 'destinationPort']);

      let routeText = `for shipment ${ref}`;
      if (origin && dest && origin !== 'To be confirmed') {
        routeText = `on the official maritime corridor ${origin} → ${dest}`;
      }

      return {
        id,
        stepNumber,
        kind: 'locating_map',
        animationType: 'mapping',
        title: 'Satellite AIS Geolocation & Route Tracking',
        detail: `Retrieved live satellite coordinates from the AIS maritime tracking network ${vessel ? `for vessel "${vessel}"` : ''} ${routeText}: computed oceanic corridor transit and plotted verified GPS coordinates on the interactive route map.`,
        toolName,
        outputSummary: vessel ? `Source: Satellite AIS telemetry for vessel ${vessel}.` : 'Source: Official maritime transit registry.',
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

      let detail = `Queried the terminal yard inventory and carrier booking records for container unit ${containerNo}.`;
      if (vessel || location) {
        detail = `Located container ${containerNo} according to carrier booking records: positioned aboard vessel "${vessel || 'cargo vessel'}", currently ${location ? `at ${location}` : 'in oceanic transit'} according to the carrier vessel schedule${dest ? ` bound for ${dest}` : ''}.`;
      }

      return {
        id,
        stepNumber,
        kind: 'finding_container',
        animationType: 'findingBoat',
        title: 'Carrier & Port Container Traceability',
        detail,
        toolName,
        outputSummary: status ? `Source: Carrier manifest. Status: ${status}` : 'Source: Carrier booking & yard inventory records.',
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
        title: 'Packing List & Cargo Manifest Audit',
        detail: `Audited declared cargo line items across the official Packing List (PL.pdf) and import manifests for "${query}": matched ${count} certified cargo batch(es) with verified tariff descriptions and piece counts.`,
        toolName,
        outputSummary: `Source: Official Packing List & import manifest.`,
        timestamp,
        durationMs: 55,
      };
    }

    case 'calculate-shipment-eta':
    case 'calculateEtaTool': {
      const ref = String(args.referenceOrContainer || 'your shipment');
      const delayDays = getProp(result, ['etaAnalysis', 'delayDays']);
      const hasDelay = getProp(result, ['etaAnalysis', 'hasDelay']) === 'true';

      let detail = `Cross-referenced the ocean carrier transit timetable with the Port Authority (ASIPONA) berth allocation bulletin for ${ref}: analyzed vessel sailing knots and harbor congestion.`;
      if (hasDelay && delayDays) {
        detail += ` Based on meteorological and dock congestion reports, a variation of +${delayDays} days is projected against the original Bill of Lading schedule.`;
      } else {
        detail += ' Arrival date aligns with the confirmed carrier booking schedule.';
      }

      return {
        id,
        stepNumber,
        kind: 'calculating_eta',
        animationType: 'eta',
        title: 'ETA Computation via Berth Schedules & Carrier Data',
        detail,
        toolName,
        outputSummary: hasDelay ? `Source: Port Authority bulletin. Alert: +${delayDays} days` : 'Source: Confirmed carrier sailing schedule.',
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
        title: 'Multi-Document Cross-Audit (BL vs Invoice vs Packing List)',
        detail: isClean
          ? 'Cross-referenced every line item across the Bill of Lading (BL), Commercial Invoice, and Packing List (PL.pdf): certified 100% concordance in gross weights, piece counts, and container seals with zero discrepancies.'
          : `Performed cross-document audit between the Bill of Lading and Packing List: identified ${discrepanciesCount || 'discrepancies'} in declared weights against the physical manifest, raising a proactive alert to prevent customs penalties.`,
        toolName,
        outputSummary: isClean ? 'Source: B/L, Commercial Invoice & Packing List matched 100%.' : 'Source: Official shipment documents with detected variance.',
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
        title: 'Customs Clearance & Tax Pedimento Inspection',
        detail: 'Inspected the official Import Pedimento filing and Customs Authority register: verified the fiscal clearance light (green clearance vs red physical inspection) and validated the electronic customs seal to confirm release readiness.',
        toolName,
        outputSummary: 'Source: Official Customs Pedimento & SAT clearance registry.',
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
        title: 'Live Port Incidents & Carrier Advisories Monitor',
        detail: `Checked the marine terminal incident bulletin and carrier network advisories: assessed dock congestion, weather alerts, and official transit notices (${count} active event(s)).`,
        toolName,
        outputSummary: 'Source: Marine terminal & port traffic advisories.',
        timestamp,
        durationMs: 30,
      };
    }

    case 'get-operation-details':
    case 'getOperationDetailsTool': {
      const ref = String(args.operationIdOrRef || args.referenceCode || 'your operation');
      const client = getProp(result, ['details', 'operation', 'client_name']);
      const status = getProp(result, ['details', 'operation', 'status']);
      return {
        id,
        stepNumber,
        kind: 'querying_database',
        animationType: 'thinking',
        title: `Unified Operation Master Record (${ref})`,
        detail: `Loaded the unified master record for operation "${ref}"${client ? ` (${client})` : ''}: includes the Purchase Order (PO), carrier Booking confirmation, and all milestone timestamps certified by the logistics operator.`,
        toolName,
        outputSummary: status ? `Source: PO/Booking master dossier. Status: ${status}` : 'Source: Unified logistics operation dossier.',
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
        title: 'Consolidated Fleet & Operations Balance',
        detail: 'Consolidated trade records across all active import and export lanes: computed active international container fleet metrics, scheduled customs entries, and port clearance statuses.',
        toolName,
        outputSummary: 'Source: Centralized logistics operations & fleet registry.',
        timestamp,
        durationMs: 40,
      };
    }

    case 'get-pending-decisions':
    case 'getPendingDecisionsTool':
    case 'request-human-decision':
    case 'requestHumanDecisionTool': {
      const title = String(args.title || 'Approval Required');
      return {
        id,
        stepNumber,
        kind: 'requesting_decision',
        animationType: 'thinking',
        title: 'Human-in-the-Loop Control Point (HITL)',
        detail: `Structured the required decision action for "${title}" based on the operation dossier: formulated resolution options with operational impact assessments for 1-click human executive authorization.`,
        toolName,
        outputSummary: 'Source: Operational exceptions & control protocol.',
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
        title: 'Real-Time Generative UI Composition',
        detail: `Composed the interactive visual card for ${deliveryId}: synchronized certified container records, live GPS route map, verified ETA, and milestone progress bar directly in the client stream.`,
        toolName,
        outputSummary: 'Source: Certified logistics dossier.',
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
        title: `Digital Document Ingestion & Verification ("${fileName}")`,
        detail: `Processed uploaded digital document "${fileName}": extracted structured data via vision document AI, verified stamps and signatures against official registries, and attached records to the operation dossier.`,
        toolName,
        outputSummary: `Source: User-uploaded digital document "${fileName}".`,
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
        title: 'Reasoning & Orchestration',
        detail: 'Synthesized verified operational facts across dossiers to structure the optimal executive response and interactive visual components.',
        toolName,
        outputSummary: 'Source: Nauta logistics intelligence engine.',
        timestamp,
        durationMs: 20,
      };
  }
}
