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
      const docType = String(args.documentType || args.documentIdOrRef || 'documento de embarque');
      return {
        id,
        stepNumber,
        kind: 'reading_document',
        animationType: 'reading',
        title: 'Leyendo documento',
        detail: `Leí el ${docType} para verificar las cantidades, el peso declarado y validar que no falte información clave para la aduana.`,
        toolName,
        outputSummary: 'Datos del documento extraídos y comprobados con éxito.',
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
        title: 'Dibujando gráficas',
        detail:
          'Estructuré las métricas disponibles para presentártelas en una gráfica interactiva clara y fácil de interpretar.',
        toolName,
        outputSummary: 'Gráfica comparativa generada.',
        timestamp,
        durationMs: 30,
      };
    }

    case 'locate-shipment-on-map':
    case 'locateMapTool': {
      const ref = String(args.referenceOrContainer || 'tu embarque');

      return {
        id,
        stepNumber,
        kind: 'locating_map',
        animationType: 'mapping',
        title: 'Ubicando en el mapa',
        detail: `Consulté las coordenadas marítimas, la ruta y la posición disponible para ${ref}.`,
        toolName,
        outputSummary: 'Ruta y coordenadas localizadas.',
        timestamp,
        durationMs: 50,
      };
    }

    case 'find-container':
    case 'findContainerTool':
    case 'get-container-status':
    case 'getContainerStatusTool': {
      const containerNo = String(args.containerNumber || args.containerQuery || 'tu contenedor');
      const vessel = getProp(result, ['container', 'current_vessel']);
      const location = getProp(result, ['container', 'current_location']);
      const status = getProp(result, ['container', 'status']);
      const dest = getProp(result, ['container', 'destination_port']);

      let detail = `Rastreé el contenedor ${containerNo} en el registro de embarques.`;
      if (vessel || location) {
        detail = `Localicé el contenedor ${containerNo}: confirmé el transporte asignado y su ubicación actual${dest ? ', además del destino registrado' : ''}.`;
      }

      return {
        id,
        stepNumber,
        kind: 'finding_container',
        animationType: 'findingBoat',
        title: 'Container por barco',
        detail,
        toolName,
        outputSummary: status ? `Estatus: ${status}` : 'Contenedor localizado en el sistema.',
        timestamp,
        durationMs: 40,
      };
    }

    case 'search-cargo-items':
    case 'searchCargoTool': {
      const query = String(args.query || 'tu mercancía');
      const count = getProp(result, ['matchedCount']) || '1';
      return {
        id,
        stepNumber,
        kind: 'finding_container',
        animationType: 'finding',
        title: 'Encontrando container',
        detail: `Revisé el catálogo y los manifiestos de carga buscando "${query}". Encontré ${count} embarque(s) coincidentes con las piezas declaradas.`,
        toolName,
        outputSummary: `Encontradas coincidencias para "${query}".`,
        timestamp,
        durationMs: 55,
      };
    }

    case 'calculate-shipment-eta':
    case 'calculateEtaTool': {
      const ref = String(args.referenceOrContainer || 'tu envío');
      const delayDays = getProp(result, ['etaAnalysis', 'delayDays']);
      const hasDelay = getProp(result, ['etaAnalysis', 'hasDelay']) === 'true';

      let detail = `Calculé los tiempos de navegación en altamar y tiempos de descarga en puerto para ${ref}.`;
      if (hasDelay && delayDays) {
        detail += ` Se detectó un desvío estimado de ${delayDays} días respecto a la fecha original.`;
      } else {
        detail += ' El embarque avanza de acuerdo con el itinerario previsto.';
      }

      return {
        id,
        stepNumber,
        kind: 'calculating_eta',
        animationType: 'eta',
        title: 'Calculando ETA',
        detail,
        toolName,
        outputSummary: hasDelay ? `Alerta: +${delayDays} días de retraso` : 'Itinerario en tiempo normal.',
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
        title: 'Comparando datos',
        detail: isClean
          ? 'Crucé los datos de la Factura Comercial, el Packing List y el Bill of Lading: los pesos, bultos y números de serie coinciden perfectamente.'
          : `Crucé los documentos de embarque y detecté ${discrepanciesCount || 'algunas'} diferencias en pesos o cantidades que requieren revisión preventiva.`,
        toolName,
        outputSummary: isClean ? 'Documentación 100% concordante.' : 'Diferencias detectadas para tu atención.',
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
        title: 'Revisando estatus de aduana',
        detail: 'Verifiqué el semáforo fiscal y el estado de pedimentos ante la autoridad aduanera para confirmar si la carga está liberada o requiere inspección previa.',
        toolName,
        outputSummary: 'Semáforo fiscal consultado.',
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
        title: 'Comprobando alertas operativas',
        detail: `Revisé el monitor de incidentes en tiempo real para verificar posibles congestiones portuarias, demoras climáticas o avisos de transportistas. (${count} alertas activas).`,
        toolName,
        outputSummary: 'Monitor de riesgos revisado.',
        timestamp,
        durationMs: 30,
      };
    }

    case 'get-operation-details':
    case 'getOperationDetailsTool': {
      const ref = String(args.operationIdOrRef || args.referenceCode || 'tu operación');
      const status = getProp(result, ['details', 'operation', 'status']);
      return {
        id,
        stepNumber,
        kind: 'querying_database',
        animationType: 'thinking',
        title: 'Consultando registro en vivo',
        detail: `Cargué el expediente completo de ${ref} desde Supabase: verifiqué contenedores asignados, historial de eventos y documentos asociados.`,
        toolName,
        outputSummary: status ? `Operación: ${status}` : 'Expediente cargado con éxito.',
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
        title: 'Consultando balance general',
        detail: 'Consulté las estadísticas globales de todas tus importaciones activas, contenedores en navegación y trámites en aduana.',
        toolName,
        outputSummary: 'Métricas operativas actualizadas.',
        timestamp,
        durationMs: 40,
      };
    }

    case 'get-pending-decisions':
    case 'getPendingDecisionsTool':
    case 'request-human-decision':
    case 'requestHumanDecisionTool': {
      const title = String(args.title || 'Aprobación requerida');
      return {
        id,
        stepNumber,
        kind: 'requesting_decision',
        animationType: 'thinking',
        title: 'Pidiendo tu visto bueno',
        detail: `Preparé la tarjeta de decisión "${title}" con opciones claras para que elijas la acción adecuada con un solo clic.`,
        toolName,
        outputSummary: 'Opciones de aprobación listas para ti.',
        timestamp,
        durationMs: 25,
      };
    }

    case 'render-json-demo':
    case 'renderDemoTool': {
      const deliveryId = String(args.deliveryId || 'tu embarque');
      return {
        id,
        stepNumber,
        kind: 'generating_ui',
        animationType: 'thinking',
        title: 'Generando tarjeta de seguimiento',
        detail: `Construí la vista interactiva con el resumen de ${deliveryId}, ruta en tiempo real, fecha de llegada (ETA) y barra de progreso.`,
        toolName,
        outputSummary: 'Vista visual interactiva generada.',
        timestamp,
        durationMs: 25,
      };
    }

    case 'ingest-uploaded-document':
    case 'ingestDocumentTool': {
      const fileName = String(args.fileName || 'archivo subido');
      return {
        id,
        stepNumber,
        kind: 'reading_document',
        animationType: 'reading',
        title: 'Leyendo documento',
        detail: `Analicé el archivo "${fileName}", extraje sus datos estructurados y los ingresé a la base de datos para seguimiento inmediato.`,
        toolName,
        outputSummary: 'Documento procesado e ingresado al sistema.',
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
        title: 'Pensando',
        detail: 'Organizando la respuesta y preparando los siguientes pasos.',
        toolName,
        timestamp,
        durationMs: 20,
      };
  }
}
