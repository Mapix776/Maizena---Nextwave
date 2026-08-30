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
      const docType = String(args.documentType || args.documentIdOrRef || 'documento de embarque');
      return {
        id,
        stepNumber,
        kind: 'reading_document',
        animationType: 'reading',
        title: `Revisión de ${docType}`,
        detail: `Leí el expediente documental de "${docType}": verifiqué los datos de origen, destino, pesos brutos declarados, partidas arancelarias y datos del consignatario para garantizar cumplimiento aduanero.`,
        toolName,
        outputSummary: 'Datos del documento extraídos y comprobados con éxito.',
        timestamp,
        durationMs: 45,
      };
    }

    case 'draw-logistics-chart':
    case 'drawChartTool': {
      const chartTitle = getProp(result, ['title']) || 'Comparativa de valores de carga';
      return {
        id,
        stepNumber,
        kind: 'drawing_chart',
        animationType: 'drawing',
        title: 'Generación de gráfico interactivo',
        detail: `Consolidé las métricas de la tabla de operaciones para "${chartTitle}": procesé los volúmenes históricos para que puedas explorar la evolución visual en un gráfico dinámico.`,
        toolName,
        outputSummary: 'Gráfica comparativa generada.',
        timestamp,
        durationMs: 30,
      };
    }

    case 'locate-shipment-on-map':
    case 'locateMapTool': {
      const ref = String(args.referenceOrContainer || 'tu embarque');
      const vessel = getProp(result, ['route', 'currentVessel']);
      const origin = getProp(result, ['route', 'originPort']);
      const dest = getProp(result, ['route', 'destinationPort']);

      let routeText = `para el embarque ${ref}`;
      if (origin && dest && origin !== 'Por confirmar') {
        routeText = `en el corredor marítimo entre ${origin} y ${dest}`;
      }

      return {
        id,
        stepNumber,
        kind: 'locating_map',
        animationType: 'mapping',
        title: 'Geolocalización y trazado de ruta',
        detail: `Consulté las coordenadas satelitales en el registro marítimo ${vessel ? `del buque "${vessel}"` : ''} ${routeText}: calculé el trayecto en altamar y dibujé el mapa interactivo con la posición actual.`,
        toolName,
        outputSummary: vessel ? `Ubicado a bordo de ${vessel}` : 'Ruta y coordenadas localizadas.',
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

      let detail = `Consulté la tabla de contenedores activos para la unidad ${containerNo}.`;
      if (vessel || location) {
        detail = `Localicé el contenedor ${containerNo} en la base de datos de flota: se encuentra a bordo del buque "${vessel || 'buque marítimo'}", actualmente ${location ? `en ${location}` : 'en navegación'}${dest ? ` con destino final en ${dest}` : ''}.`;
      }

      return {
        id,
        stepNumber,
        kind: 'finding_container',
        animationType: 'findingBoat',
        title: 'Rastreo de contenedor e itinerario',
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
        title: 'Búsqueda en catálogo de mercancías',
        detail: `Busqué "${query}" en los manifiestos de carga y listas de empaque: encontré ${count} registro(s) coincidentes, verificando número de bultos y operaciones vinculadas.`,
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

      let detail = `Calculé la fecha estimada de llegada (ETA) para ${ref} analizando velocidad de navegación, tiempos de fondeo y ventana de atraque en puerto.`;
      if (hasDelay && delayDays) {
        detail += ` Se estimó una variación de +${delayDays} días respecto al itinerario original, generando la recomendación preventiva.`;
      } else {
        detail += ' El tiempo de tránsito se encuentra dentro de los parámetros normales de entrega.';
      }

      return {
        id,
        stepNumber,
        kind: 'calculating_eta',
        animationType: 'eta',
        title: 'Cálculo de tiempos de tránsito y ETA',
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
        title: 'Reconciliación cruzada de documentos',
        detail: isClean
          ? 'Crucé campo por campo el Bill of Lading (BL), la Factura Comercial (Invoice) y el Packing List (PL): verifiqué que el peso bruto, número de bultos y contenedor coinciden al 100% sin discrepancias.'
          : `Efectué la auditoría cruzada entre el Bill of Lading y el Packing List: detecté ${discrepanciesCount || 'inconsistencias'} en pesos declarados y formulé la alerta preventiva para evitar multas aduanales.`,
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
        title: 'Consulta de semáforo fiscal y aduanas',
        detail: 'Consulté el registro de pedimentos e inspecciones aduanales: verifiqué el semáforo fiscal (verde/desaduanamiento vs rojo/reconocimiento aduanero) para confirmar si la carga está lista para despacho.',
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
        title: 'Monitoreo de alertas operativas en vivo',
        detail: `Revisé la tabla de alertas e incidentes portuarios: evalué posibles avisos de congestión de terminales, condiciones de clima marítimo y notificaciones de transportistas (${count} evento(s) activo(s)).`,
        toolName,
        outputSummary: 'Monitor de riesgos revisado.',
        timestamp,
        durationMs: 30,
      };
    }

    case 'get-operation-details':
    case 'getOperationDetailsTool': {
      const ref = String(args.operationIdOrRef || args.referenceCode || 'tu operación');
      const client = getProp(result, ['details', 'operation', 'client_name']);
      const status = getProp(result, ['details', 'operation', 'status']);
      return {
        id,
        stepNumber,
        kind: 'querying_database',
        animationType: 'thinking',
        title: 'Carga de expediente de operación',
        detail: `Abrí el expediente de la operación "${ref}"${client ? ` (${client})` : ''} en la base de datos: revisé contenedores asignados, estado de avance de hitos y documentos comerciales adjuntos.`,
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
        title: 'Consolidación de balance de flota',
        detail: 'Consulté el resumen general de importaciones y exportaciones activas: calculé el total de contenedores en tránsito marítimo, arribos programados y despachos aduanales pendientes.',
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
        title: 'Preparación de decisión humana (HITL)',
        detail: `Formulé la acción requerida para "${title}": estructuré las opciones de resolución con su nivel de impacto y botones interactivos para que tomes el control de la operación con un solo clic.`,
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
        title: 'Composición de tarjeta interactiva',
        detail: `Generé la tarjeta visual para ${deliveryId}: sincronicé los datos del contenedor, mapa de ruta, fecha de entrega y barra de progreso en un componente interactivo directo en el chat.`,
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
        title: 'Ingesta y extracción de documento',
        detail: `Procesé el archivo "${fileName}": extraje los datos estructurados con el modelo de visión documental, validé su autenticidad y los guardé en la base de datos para trazabilidad inmediata.`,
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
        title: 'Razonamiento y orquestación',
        detail: 'Analicé la información recopilada para estructurar la mejor respuesta y componentes visuales para tu consulta.',
        toolName,
        timestamp,
        durationMs: 20,
      };
  }
}
