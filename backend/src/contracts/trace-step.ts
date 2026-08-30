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

export type ExecutionStepKind = z.infer<typeof executionStepKindSchema>;

export const executionTraceStepSchema = z.object({
  id: z.string(),
  stepNumber: z.number(),
  kind: executionStepKindSchema,
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
 * Helper to map tool names to intuitive, 100% non-technical, client-friendly descriptions
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
      const docType = String(args.documentType || args.documentIdOrRef || 'documento de embarque');
      return {
        id,
        stepNumber,
        kind: 'reading_document',
        title: 'Revisando documentos del envío',
        detail: `Leyendo ${docType} para verificar pesos, cantidades y productos declarados.`,
        toolName,
        outputSummary: 'Datos del documento extraídos correctamente.',
        timestamp,
        durationMs: 45,
      };
    }

    case 'draw-logistics-chart':
    case 'drawChartTool':
      return {
        id,
        stepNumber,
        kind: 'drawing_chart',
        title: 'Preparando gráfica de seguimiento',
        detail: 'Calculando métricas y organizando las cantidades para mostrártelas en una gráfica clara.',
        toolName,
        outputSummary: 'Gráfica generada con éxito.',
        timestamp,
        durationMs: 30,
      };

    case 'locate-shipment-on-map':
    case 'locateMapTool': {
      const ref = String(args.referenceOrContainer || 'tu embarque');
      return {
        id,
        stepNumber,
        kind: 'locating_map',
        title: 'Ubicando la ruta en el mapa',
        detail: `Consultando los puertos de salida y destino, y la ubicación actual del barco para ${ref}.`,
        toolName,
        outputSummary: 'Ruta y coordenadas encontradas.',
        timestamp,
        durationMs: 50,
      };
    }

    case 'find-container':
    case 'findContainerTool': {
      const containerNo = String(args.containerQuery || 'contenedor');
      return {
        id,
        stepNumber,
        kind: 'finding_container',
        title: 'Rastreando tu contenedor',
        detail: `Buscando el contenedor ${containerNo} en el sistema para conocer en qué barco viaja y su estado.`,
        toolName,
        outputSummary: 'Contenedor localizado en el sistema.',
        timestamp,
        durationMs: 40,
      };
    }

    case 'search-cargo-items':
    case 'searchCargoTool': {
      const query = String(args.query || 'tu mercancía');
      return {
        id,
        stepNumber,
        kind: 'finding_container',
        title: 'Buscando tu mercancía',
        detail: `Revisando los manifiestos de carga para encontrar dónde vienen tus "${query}".`,
        toolName,
        outputSummary: 'Mercancía identificada en los registros.',
        timestamp,
        durationMs: 55,
      };
    }

    case 'calculate-shipment-eta':
    case 'calculateEtaTool': {
      const ref = String(args.referenceOrContainer || 'tu envío');
      return {
        id,
        stepNumber,
        kind: 'calculating_eta',
        title: 'Calculando fecha de llegada (ETA)',
        detail: `Revisando los tiempos de navegación y posibles demoras en puerto para ${ref}.`,
        toolName,
        outputSummary: 'Fecha de entrega estimada calculada.',
        timestamp,
        durationMs: 35,
      };
    }

    case 'compare-shipment-data':
    case 'compareDataTool':
    case 'reconcile-shipment-documents':
    case 'reconcileShipmentDocumentsTool':
      return {
        id,
        stepNumber,
        kind: 'comparing_data',
        title: 'Comprobando que todo coincida',
        detail: 'Cruzando los datos de la factura comercial, lista de empaque y aduana para evitar multas o demoras.',
        toolName,
        outputSummary: 'Verificación de concordancia completada.',
        timestamp,
        durationMs: 60,
      };

    case 'get-customs-status':
    case 'getCustomsStatusTool':
      return {
        id,
        stepNumber,
        kind: 'querying_database',
        title: 'Revisando estatus de aduana',
        detail: 'Verificando si el contenedor tiene luz verde o si fue seleccionado para revisión física.',
        toolName,
        outputSummary: 'Estatus aduanal consultado.',
        timestamp,
        durationMs: 35,
      };

    case 'get-operational-alerts':
    case 'getOperationalAlertsTool':
      return {
        id,
        stepNumber,
        kind: 'querying_database',
        title: 'Comprobando alertas o retrasos',
        detail: 'Revisando si hay avisos urgentes de congestión en puerto, clima o demoras.',
        toolName,
        outputSummary: 'Alertas revisadas.',
        timestamp,
        durationMs: 30,
      };

    case 'get-operation-details':
    case 'getOperationDetailsTool':
    case 'get-container-status':
    case 'getContainerStatusTool':
    case 'get-operations-summary':
    case 'getOperationsSummaryTool':
    case 'universal-logistics-search':
    case 'universalSearchTool':
      return {
        id,
        stepNumber,
        kind: 'querying_database',
        title: 'Consultando registro en vivo',
        detail: 'Obteniendo los datos actualizados de tu operación de importación.',
        toolName,
        outputSummary: 'Información actualizada obtenida.',
        timestamp,
        durationMs: 40,
      };

    case 'get-pending-decisions':
    case 'getPendingDecisionsTool':
      return {
        id,
        stepNumber,
        kind: 'requesting_decision',
        title: 'Buscando aprobaciones pendientes',
        detail: 'Verificando si hay decisiones operativas que requieran tu visto bueno.',
        toolName,
        outputSummary: 'Aprobaciones identificadas.',
        timestamp,
        durationMs: 25,
      };

    case 'request-human-decision':
    case 'requestHumanDecisionTool':
      return {
        id,
        stepNumber,
        kind: 'requesting_decision',
        title: 'Pidiendo tu decisión',
        detail: 'Preparando opciones sencillas y claras para que elijas cómo proceder con un solo clic.',
        toolName,
        outputSummary: 'Tarjeta de decisión lista para ti.',
        timestamp,
        durationMs: 20,
      };

    case 'render-json-demo':
    case 'renderDemoTool':
      return {
        id,
        stepNumber,
        kind: 'generating_ui',
        title: 'Generando tu tarjeta de seguimiento',
        detail: 'Creando la vista visual interactiva con el resumen de tu envío y barra de progreso.',
        toolName,
        outputSummary: 'Vista interactiva creada.',
        timestamp,
        durationMs: 25,
      };

    case 'ingest-uploaded-document':
    case 'ingestDocumentTool': {
      const fileName = String(args.fileName || 'archivo subido');
      return {
        id,
        stepNumber,
        kind: 'reading_document',
        title: 'Procesando tu documento',
        detail: `Extrayendo datos de "${fileName}" e ingresándolos al sistema para rastreo inmediato.`,
        toolName,
        outputSummary: 'Documento procesado e ingresado.',
        timestamp,
        durationMs: 65,
      };
    }

    default:
      return {
        id,
        stepNumber,
        kind: 'thinking',
        title: 'Revisando información',
        detail: 'Analizando los registros logísticos para responder a tu consulta de la manera más clara.',
        toolName,
        timestamp,
        durationMs: 30,
      };
  }
}
