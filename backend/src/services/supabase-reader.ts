import type {
  ContainerRow,
  DecisionRow,
  DocumentPartyRow,
  DocumentRelationshipRow,
  DocumentRow,
  EventRow,
  OperationRow,
  RunRow,
} from '../types/database.js';

export interface CargoItemSearchResult {
  operationId: string;
  referenceCode: string;
  clientName: string;
  operationStatus: string;
  matchedItem: {
    description: string;
    quantity?: number;
    unitPriceUsd?: number;
    sourceDocument?: string;
    containerNumber?: string;
  };
  containers: Array<{
    containerNumber: string;
    status: string;
    currentLocation: string | null;
    currentVessel: string | null;
    originPort: string | null;
    destinationPort: string | null;
    eta: string | null;
    originalEta: string | null;
    actualArrival: string | null;
    customsLight?: string | null;
  }>;
  alerts: Array<{
    severity: string;
    title: string;
    message: string;
  }>;
}

export interface OperationFullDetails {
  operation: OperationRow;
  containers: ContainerRow[];
  documents: DocumentRow[];
  events: EventRow[];
  decisions: DecisionRow[];
  runs: RunRow[];
  parties: DocumentPartyRow[];
  relationships: DocumentRelationshipRow[];
}

export interface OperationsMetricsSummary {
  totalOperations: number;
  byStatus: Record<string, number>;
  totalContainers: number;
  containersInTransit: number;
  containersInCustoms: number;
  delayedContainersCount: number;
  criticalAlertsCount: number;
  pendingDecisionsCount: number;
}

export interface UniversalSearchResult {
  operations: OperationRow[];
  containers: ContainerRow[];
  documents: DocumentRow[];
  parties: DocumentPartyRow[];
  events: EventRow[];
  decisions: DecisionRow[];
}

export interface SupabaseReaderConfig {
  url?: string;
  serviceRoleKey?: string;
  fetch?: typeof fetch;
}

export class SupabaseReader {
  static readonly #readCache = new Map<string, { expiresAt: number; value: unknown }>();
  static readonly #readCacheTtlMs = 2_000;
  readonly #url: string;
  readonly #serviceRoleKey: string;
  readonly #fetch: typeof fetch;

  constructor(options: SupabaseReaderConfig = {}) {
    this.#url = (options.url ?? process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
    this.#serviceRoleKey =
      options.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  /** In-memory micro-cache for repeated read-only UI queries within one run. */
  static clearReadCache(): void {
    this.#readCache.clear();
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!this.#url || !this.#serviceRoleKey) {
      throw new Error(
        'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend.',
      );
    }

    const url = `${this.#url}/rest/v1/${path}`;
    const isRead = !options.method || options.method.toUpperCase() === 'GET';
    const now = Date.now();
    const cached = isRead ? SupabaseReader.#readCache.get(url) : undefined;
    if (cached && cached.expiresAt > now) {
      return structuredClone(cached.value) as T;
    }
    const headers = {
      apikey: this.#serviceRoleKey,
      Authorization: `Bearer ${this.#serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await this.#fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Supabase request failed [${response.status} ${response.statusText}]: ${errorText}`,
      );
    }

    const data = (await response.json()) as T;
    if (isRead) {
      SupabaseReader.#readCache.set(url, {
        expiresAt: now + SupabaseReader.#readCacheTtlMs,
        value: structuredClone(data),
      });
    }
    return data;
  }

  // ===========================================================================
  // 1. CONSULTAS DE OPERACIONES (OPERATIONS)
  // ===========================================================================

  /** Búsqueda por texto libre en código de referencia o nombre de cliente */
  async searchOperations(query: string): Promise<OperationRow[]> {
    const q = encodeURIComponent(query.trim());
    if (!q) return [];
    return this.request<OperationRow[]>(
      `operations?or=(reference_code.ilike.*${q}*,client_name.ilike.*${q}*)&select=*&order=created_at.desc`,
    );
  }

  /** Obtiene operación por su código (ej. 'OP-2026-101'), UUID o palabras clave como 'current'/'latest' */
  async getOperationByReferenceOrId(refOrId: string): Promise<OperationRow | null> {
    const clean = refOrId.trim();
    if (!clean) {
      const latest = await this.request<OperationRow[]>('operations?select=*&order=created_at.desc&limit=1');
      return latest[0] ?? null;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
    const filter = isUuid
      ? `id=eq.${clean}`
      : `reference_code=eq.${encodeURIComponent(clean)}`;

    const rows = await this.request<OperationRow[]>(`operations?${filter}&select=*&limit=1`);
    if (rows[0]) return rows[0];

    // Búsqueda flexible ilike
    const fuzzyRows = await this.request<OperationRow[]>(
      `operations?reference_code=ilike.*${encodeURIComponent(clean)}*&select=*&limit=1`,
    );
    if (fuzzyRows[0]) return fuzzyRows[0];

    // Si el usuario dijo 'current', 'latest', 'active', 'actual' o no se encontró por código específico, retornar la operación más reciente
    const isGenericCurrent = ['current', 'latest', 'active', 'actual', 'operacion actual', 'the current operation', 'main'].includes(
      clean.toLowerCase(),
    );
    if (isGenericCurrent) {
      const latest = await this.request<OperationRow[]>('operations?select=*&order=created_at.desc&limit=1');
      return latest[0] ?? null;
    }

    return null;
  }

  /** Listar operaciones con filtros opcionales */
  async listOperations(params: {
    status?: string;
    clientName?: string;
    tag?: string;
    limit?: number;
  } = {}): Promise<OperationRow[]> {
    const queryParts: string[] = ['select=*', 'order=created_at.desc'];
    if (params.status) {
      queryParts.push(`status=eq.${encodeURIComponent(params.status)}`);
    }
    if (params.clientName) {
      queryParts.push(`client_name=ilike.*${encodeURIComponent(params.clientName)}*`);
    }
    if (params.tag) {
      queryParts.push(`tags=cs.{${encodeURIComponent(params.tag)}}`);
    }
    if (params.limit) {
      queryParts.push(`limit=${params.limit}`);
    }
    return this.request<OperationRow[]>(`operations?${queryParts.join('&')}`);
  }

  /** Obtener operaciones que tienen discrepancias documentales registradas */
  async getOperationsWithDiscrepancies(): Promise<OperationRow[]> {
    return this.request<OperationRow[]>(
      `operations?discrepancies=neq.[]&select=*&order=created_at.desc`,
    );
  }

  /** Obtener todas las operaciones en estado EXCEPTION */
  async getExceptionOperations(): Promise<OperationRow[]> {
    return this.listOperations({ status: 'EXCEPTION' });
  }

  /** Obtener operaciones por cliente específico */
  async getOperationsByClient(clientName: string): Promise<OperationRow[]> {
    return this.listOperations({ clientName });
  }

  // ===========================================================================
  // 2. CONSULTAS DE CONTENEDORES (CONTAINERS)
  // ===========================================================================

  /** Obtener todos los contenedores de una operación */
  async getContainersByOperation(operationId: string): Promise<ContainerRow[]> {
    return this.request<ContainerRow[]>(
      `containers?operation_id=eq.${operationId}&select=*&order=container_number.asc`,
    );
  }

  /** Obtener un contenedor específico por su número (ej. 'MSKU1234567') */
  async getContainerByNumber(containerNumber: string): Promise<ContainerRow | null> {
    const rows = await this.request<ContainerRow[]>(
      `containers?container_number=eq.${encodeURIComponent(containerNumber.trim())}&select=*&limit=1`,
    );
    return rows[0] ?? null;
  }

  /** Obtener contenedor enriquecido con datos de su operación y puertos */
  async getEnrichedContainerByNumber(containerNumber: string) {
    const container = await this.getContainerByNumber(containerNumber);
    if (!container) return null;

    let originPort: string | null | undefined = container.origin_port;
    let destinationPort: string | null | undefined = container.destination_port;
    let operationRef = '';
    let clientName = '';

    if (container.operation_id) {
      const op = await this.getOperationByReferenceOrId(container.operation_id).catch(() => null);
      if (op) {
        operationRef = op.reference_code;
        clientName = op.client_name;
        const canonical = (op.canonical_data ?? {}) as Record<string, unknown>;
        if (!originPort) {
          const originVal = canonical.origin_port as { value?: string } | string | undefined;
          originPort = (typeof originVal === 'object' ? originVal?.value : originVal) || undefined;
        }
        if (!destinationPort) {
          const destVal = canonical.destination_port as { value?: string } | string | undefined;
          destinationPort = (typeof destVal === 'object' ? destVal?.value : destVal) || undefined;
        }
      }
    }

    return {
      ...container,
      operationReference: operationRef || container.container_number,
      clientName: clientName || '',
      origin_port: originPort ?? container.origin_port ?? null,
      destination_port: destinationPort ?? container.destination_port ?? null,
    };
  }

  /** Listar contenedores por estado ('IN_TRANSIT', 'AT_PORT', 'CUSTOMS_HOLD', 'RELEASED', etc.) */
  async getContainersByStatus(status: string): Promise<ContainerRow[]> {
    return this.request<ContainerRow[]>(
      `containers?status=eq.${encodeURIComponent(status)}&select=*&order=created_at.desc`,
    );
  }

  /** Consultar contenedores por buque actual */
  async getContainersByVessel(vesselName: string): Promise<ContainerRow[]> {
    return this.request<ContainerRow[]>(
      `containers?current_vessel=ilike.*${encodeURIComponent(vesselName.trim())}*&select=*&order=eta.asc`,
    );
  }

  /** Consultar contenedores por puerto (origen o destino) */
  async getContainersByPort(portName: string, role: 'origin' | 'destination' | 'any' = 'any'): Promise<ContainerRow[]> {
    const p = encodeURIComponent(portName.trim());
    if (role === 'origin') {
      return this.request<ContainerRow[]>(`containers?origin_port=ilike.*${p}*&select=*`);
    }
    if (role === 'destination') {
      return this.request<ContainerRow[]>(`containers?destination_port=ilike.*${p}*&select=*`);
    }
    return this.request<ContainerRow[]>(
      `containers?or=(origin_port.ilike.*${p}*,destination_port.ilike.*${p}*)&select=*`,
    );
  }

  /** Consultar contenedores por semáforo fiscal aduanero ('green' | 'red' | 'pending') */
  async getContainersByCustomsLight(customsLight: 'green' | 'red' | 'pending'): Promise<ContainerRow[]> {
    return this.request<ContainerRow[]>(
      `containers?customs_light=eq.${customsLight}&select=*&order=updated_at.desc`,
    );
  }

  /** Consultar contenedores con número de pedimento registrado */
  async getContainersWithPedimento(): Promise<ContainerRow[]> {
    return this.request<ContainerRow[]>(
      `containers?pedimento_number=not.is.null&select=*&order=updated_at.desc`,
    );
  }

  /** Consultar contenedores con revisión física "previo" completada */
  async getContainersWithPrevioCompleted(): Promise<ContainerRow[]> {
    return this.request<ContainerRow[]>(
      `containers?previo_completed_at=not.is.null&select=*&order=previo_completed_at.desc`,
    );
  }

  /** Obtener contenedores que sufrieron retraso (ETA actual mayor que ETA original) */
  async getDelayedContainers(): Promise<ContainerRow[]> {
    // Retorna contenedores no entregados donde eta > original_eta
    const rows = await this.request<ContainerRow[]>(
      `containers?status=neq.DELIVERED&eta=not.is.null&original_eta=not.is.null&select=*`,
    );
    return rows.filter((c) => c.eta && c.original_eta && new Date(c.eta) > new Date(c.original_eta));
  }

  // ===========================================================================
  // 3. CONSULTAS DE DOCUMENTOS Y PARTES (DOCUMENTS, PARTIES, RELATIONS)
  // ===========================================================================

  /** Obtener todos los documentos asociados a una operación */
  async getDocumentsByOperation(operationId: string, type?: string): Promise<DocumentRow[]> {
    let path = `documents?operation_id=eq.${operationId}&select=*&order=created_at.desc`;
    if (type) {
      path += `&type=eq.${encodeURIComponent(type)}`;
    }
    return this.request<DocumentRow[]>(path);
  }

  /** Buscar documento por referencia oficial (ej. B/L #, Factura #, PO #, Pedimento #) */
  async getDocumentByReference(reference: string): Promise<DocumentRow | null> {
    const rows = await this.request<DocumentRow[]>(
      `documents?document_reference=eq.${encodeURIComponent(reference.trim())}&select=*&limit=1`,
    );
    return rows[0] ?? null;
  }

  /** Obtener partes (comprador, proveedor, transportista, etc.) nombradas en documentos */
  async getDocumentParties(params: {
    documentId?: string;
    partyRole?: string;
    partyName?: string;
  } = {}): Promise<DocumentPartyRow[]> {
    const queryParts: string[] = ['select=*'];
    if (params.documentId) {
      queryParts.push(`document_id=eq.${params.documentId}`);
    }
    if (params.partyRole) {
      queryParts.push(`party_role=eq.${encodeURIComponent(params.partyRole)}`);
    }
    if (params.partyName) {
      queryParts.push(`party_name=ilike.*${encodeURIComponent(params.partyName)}*`);
    }
    return this.request<DocumentPartyRow[]>(`document_parties?${queryParts.join('&')}`);
  }

  /** Obtener relaciones entre documentos (ej. DISCREPANCY_WITH, SUPERSEDES) */
  async getDocumentRelationships(documentId: string): Promise<DocumentRelationshipRow[]> {
    return this.request<DocumentRelationshipRow[]>(
      `document_relationships?or=(source_document_id.eq.${documentId},target_document_id.eq.${documentId})&select=*`,
    );
  }

  // ===========================================================================
  // 4. CONSULTAS DE EVENTOS Y ALERTAS (EVENTS)
  // ===========================================================================

  /** Obtener eventos/alertas con filtros */
  async getEvents(options: {
    operationId?: string;
    severity?: string;
    category?: string;
    unacknowledgedOnly?: boolean;
    limit?: number;
  } = {}): Promise<EventRow[]> {
    const queryParts: string[] = ['select=*', 'order=created_at.desc'];
    if (options.operationId) {
      queryParts.push(`operation_id=eq.${options.operationId}`);
    }
    if (options.severity) {
      queryParts.push(`severity=eq.${encodeURIComponent(options.severity)}`);
    }
    if (options.category) {
      queryParts.push(`category=eq.${encodeURIComponent(options.category)}`);
    }
    if (options.unacknowledgedOnly) {
      queryParts.push(`acknowledged=eq.false`);
    }
    if (options.limit) {
      queryParts.push(`limit=${options.limit}`);
    }
    return this.request<EventRow[]>(`events?${queryParts.join('&')}`);
  }

  /** Obtener alertas críticas sin atender */
  async getCriticalAlerts(limit: number = 20): Promise<EventRow[]> {
    return this.getEvents({ severity: 'CRITICAL', unacknowledgedOnly: true, limit });
  }

  // ===========================================================================
  // 5. CONSULTAS DE DECISIONES HUMAN-IN-THE-LOOP (DECISIONS)
  // ===========================================================================

  /** Obtener decisiones Human-in-the-Loop pendientes enriquecidas con código de operación y cliente */
  async getPendingDecisions(operationId?: string): Promise<DecisionRow[]> {
    let path = `decisions?status=eq.PENDING&select=*&order=created_at.desc`;
    if (operationId) {
      path += `&operation_id=eq.${operationId}`;
    }
    return this.request<DecisionRow[]>(path);
  }

  async getEnrichedPendingDecisions(operationId?: string) {
    const decisions = await this.getPendingDecisions(operationId);
    const enriched = await Promise.all(
      decisions.map(async (d) => {
        const op = await this.getOperationByReferenceOrId(d.operation_id).catch(() => null);
        return {
          id: d.id,
          operationId: d.operation_id,
          operationReference: op?.reference_code || 'OP-2026',
          clientName: op?.client_name || 'Client',
          title: d.title,
          description: d.description || '',
          severity: d.severity,
          options: d.options_json,
          defaultAction: d.default_action,
        };
      }),
    );
    return enriched;
  }

  /** Obtener decisión por UUID */
  async getDecisionById(decisionId: string): Promise<DecisionRow | null> {
    const rows = await this.request<DecisionRow[]>(
      `decisions?id=eq.${decisionId}&select=*&limit=1`,
    );
    return rows[0] ?? null;
  }

  // ===========================================================================
  // 6. CONSULTAS DE EJECUCIÓN DE AGENTES (RUNS)
  // ===========================================================================

  /** Obtener runs por operación o agente */
  async getRuns(options: {
    operationId?: string;
    agentName?: string;
    status?: string;
    limit?: number;
  } = {}): Promise<RunRow[]> {
    const queryParts: string[] = ['select=*', 'order=created_at.desc'];
    if (options.operationId) {
      queryParts.push(`operation_id=eq.${options.operationId}`);
    }
    if (options.agentName) {
      queryParts.push(`agent_name=eq.${encodeURIComponent(options.agentName)}`);
    }
    if (options.status) {
      queryParts.push(`status=eq.${encodeURIComponent(options.status)}`);
    }
    if (options.limit) {
      queryParts.push(`limit=${options.limit}`);
    }
    return this.request<RunRow[]>(`runs?${queryParts.join('&')}`);
  }

  // ===========================================================================
  // 7. CONSULTAS INTEGRADAS Y ANALÍTICA (360 VIEW & METRICS)
  // ===========================================================================

  /** Obtener detalle 360° unificado de una operación */
  async getOperationFullDetails(refOrId: string): Promise<OperationFullDetails | null> {
    const op = await this.getOperationByReferenceOrId(refOrId);
    if (!op) return null;

    const [containers, documents, events, decisions, runs] = await Promise.all([
      this.getContainersByOperation(op.id),
      this.getDocumentsByOperation(op.id),
      this.getEvents({ operationId: op.id }),
      this.getPendingDecisions(op.id),
      this.getRuns({ operationId: op.id }),
    ]);

    let parties: DocumentPartyRow[] = [];
    let relationships: DocumentRelationshipRow[] = [];

    if (documents.length > 0) {
      const docIds = documents.map((d) => `"${d.id}"`).join(',');
      try {
        const [partiesRes, relsRes] = await Promise.all([
          this.request<DocumentPartyRow[]>(`document_parties?document_id=in.(${docIds})&select=*`),
          this.request<DocumentRelationshipRow[]>(
            `document_relationships?source_document_id=in.(${docIds})&select=*`,
          ),
        ]);
        parties = partiesRes;
        relationships = relsRes;
      } catch {
        // Tablas auxiliares opcionales
      }
    }

    return {
      operation: op,
      containers,
      documents,
      events,
      decisions,
      runs,
      parties,
      relationships,
    };
  }

  /** Resumen de métricas operativas en tiempo real */
  async getOperationsMetricsSummary(): Promise<OperationsMetricsSummary> {
    const [operations, containers, criticalEvents, pendingDecisions] = await Promise.all([
      this.listOperations({ limit: 1000 }),
      this.request<ContainerRow[]>(`containers?select=*`),
      this.getCriticalAlerts(100),
      this.getPendingDecisions(),
    ]);

    const byStatus: Record<string, number> = {};
    for (const op of operations) {
      byStatus[op.status] = (byStatus[op.status] ?? 0) + 1;
    }

    let inTransit = 0;
    let inCustoms = 0;
    let delayed = 0;

    for (const c of containers) {
      if (c.status === 'IN_TRANSIT') inTransit++;
      if (c.status === 'CUSTOMS_HOLD' || c.status === 'CUSTOMS_CLEARANCE') inCustoms++;
      if (c.status !== 'DELIVERED' && c.eta && c.original_eta && new Date(c.eta) > new Date(c.original_eta)) {
        delayed++;
      }
    }

    return {
      totalOperations: operations.length,
      byStatus,
      totalContainers: containers.length,
      containersInTransit: inTransit,
      containersInCustoms: inCustoms,
      delayedContainersCount: delayed,
      criticalAlertsCount: criticalEvents.length,
      pendingDecisionsCount: pendingDecisions.length,
    };
  }

  /**
   * 8. BÚSQUEDA UNIVERSAL (Búsqueda global cruzando todas las entidades)
   */
  async universalSearch(query: string): Promise<UniversalSearchResult> {
    const q = query.trim();
    if (!q) {
      return { operations: [], containers: [], documents: [], parties: [], events: [], decisions: [] };
    }

    const [operations, containers, documents, parties, events, decisions] = await Promise.all([
      this.searchOperations(q).catch(() => []),
      this.request<ContainerRow[]>(
        `containers?or=(container_number.ilike.*${encodeURIComponent(q)}*,current_vessel.ilike.*${encodeURIComponent(q)}*,origin_port.ilike.*${encodeURIComponent(q)}*,destination_port.ilike.*${encodeURIComponent(q)}*)&select=*`,
      ).catch(() => []),
      this.request<DocumentRow[]>(
        `documents?or=(file_name.ilike.*${encodeURIComponent(q)}*,document_reference.ilike.*${encodeURIComponent(q)}*)&select=*`,
      ).catch(() => []),
      this.getDocumentParties({ partyName: q }).catch(() => []),
      this.request<EventRow[]>(
        `events?or=(title.ilike.*${encodeURIComponent(q)}*,message.ilike.*${encodeURIComponent(q)}*)&select=*`,
      ).catch(() => []),
      this.request<DecisionRow[]>(
        `decisions?or=(title.ilike.*${encodeURIComponent(q)}*,description.ilike.*${encodeURIComponent(q)}*)&select=*`,
      ).catch(() => []),
    ]);

    return {
      operations,
      containers,
      documents,
      parties,
      events,
      decisions,
    };
  }

  /**
   * 9. BÚSQUEDA DE MERCANCÍA / CARGA (Resuelve: "Have the dining tables arrived?", "Where are the auto parts?")
   */
  async searchCargoItems(itemQuery: string): Promise<CargoItemSearchResult[]> {
    const raw = itemQuery.toLowerCase().trim();
    if (!raw) return [];

    // Expansión de sinónimos en inglés/español para búsquedas en inglés
    const synonymsMap: Record<string, string[]> = {
      'dining table': ['comedor', 'comedores', 'muebles', 'furniture', 'dining'],
      'dining tables': ['comedor', 'comedores', 'muebles', 'furniture', 'dining'],
      'dining set': ['comedor', 'comedores', 'muebles', 'furniture'],
      'dining sets': ['comedor', 'comedores', 'muebles', 'furniture'],
      dining: ['comedor', 'comedores', 'muebles', 'furniture', 'mesa', 'mesas'],
      table: ['mesa', 'mesas', 'comedor', 'comedores', 'furniture', 'muebles'],
      tables: ['mesa', 'mesas', 'comedor', 'comedores', 'furniture', 'muebles'],
      furniture: ['muebles', 'mueble', 'comedor', 'comedores', 'mesa', 'mesas'],
      chair: ['silla', 'sillas', 'muebles', 'furniture'],
      chairs: ['silla', 'sillas', 'muebles', 'furniture'],
      electronics: ['electrónicos', 'electronicos', 'tech', 'chips'],
      autoparts: ['autopartes', 'automotriz', 'auto parts', 'repuestos'],
      'auto parts': ['autopartes', 'automotriz', 'repuestos'],
      pharma: ['farma', 'farmaceuticos', 'medicamentos', 'pharmaceuticals'],
      textiles: ['textil', 'telas', 'ropa', 'apparel'],
      comedores: ['dining', 'dining tables', 'furniture', 'muebles'],
      comedor: ['dining', 'dining tables', 'furniture', 'muebles'],
      mesas: ['tables', 'dining', 'furniture', 'muebles'],
      mesa: ['table', 'dining', 'furniture', 'muebles'],
    };

    const searchTerms = new Set<string>([raw]);
    // Extraer palabras clave del input
    const words = raw.split(/\s+/).filter((w) => w.length > 2);
    for (const word of words) {
      searchTerms.add(word);
      if (synonymsMap[word]) {
        for (const s of synonymsMap[word]) searchTerms.add(s);
      }
    }
    for (const [k, v] of Object.entries(synonymsMap)) {
      if (raw.includes(k)) {
        for (const s of v) searchTerms.add(s);
      }
    }

    const termsArray = Array.from(searchTerms);
    const matchesAnyTerm = (text: string) => {
      const lower = text.toLowerCase();
      return termsArray.some((t) => lower.includes(t));
    };

    const operations = await this.listOperations({ limit: 50 });
    if (operations.length === 0) return [];

    // Fetch the document corpus once instead of issuing one request per operation.
    const operationIds = operations.map((op) => op.id);
    const allDocuments = await this.request<DocumentRow[]>(
      `documents?operation_id=in.(${operationIds.join(',')})&select=operation_id,type,file_name,extracted_json`,
    );
    const documentsByOperation = new Map<string, DocumentRow[]>();
    for (const document of allDocuments) {
      const current = documentsByOperation.get(document.operation_id) ?? [];
      current.push(document);
      documentsByOperation.set(document.operation_id, current);
    }

    const matchedOperations: Array<{
      operation: OperationRow;
      description: string;
      quantity?: number;
      unitPriceUsd?: number;
      sourceDocument?: string;
    }> = [];

    for (const op of operations) {
      let matchFound = false;
      let matchedDescription = '';
      let matchedQuantity: number | undefined;
      let matchedPrice: number | undefined;
      let matchedDoc: string | undefined;

      // 1. Revisar tags, notas y cliente
      const tagMatch = op.tags?.some((t) => matchesAnyTerm(t));
      const notesMatch = op.notes ? matchesAnyTerm(op.notes) : false;
      const clientMatch = matchesAnyTerm(op.client_name);

      if (tagMatch || notesMatch || clientMatch) {
        matchFound = true;
        matchedDescription = tagMatch
          ? `Tag: ${op.tags?.join(', ')}`
          : clientMatch
            ? `Client: ${op.client_name}`
            : `Notes: ${op.notes}`;
      }

      // 2. Revisar canonical_data
      if (!matchFound && op.canonical_data) {
        const canonicalStr = JSON.stringify(op.canonical_data);
        if (matchesAnyTerm(canonicalStr)) {
          matchFound = true;
          matchedDescription = `Canonical shipment cargo data`;
        }
      }

      // 3. Revisar documentos extraídos (Commercial Invoice, Packing List, PO)
      const docs = documentsByOperation.get(op.id) ?? [];
      for (const doc of docs) {
        if (!doc.extracted_json) continue;
        const extracted = doc.extracted_json as Record<string, unknown>;

        const items = (extracted.items ?? extracted.line_items ?? extracted.cargo_items) as
          | Array<Record<string, unknown>>
          | undefined;

        if (Array.isArray(items)) {
          for (const item of items) {
            const desc = String(
              item.description ?? item.name ?? item.item_description ?? item.product ?? '',
            );
            if (matchesAnyTerm(desc)) {
              matchFound = true;
              matchedDescription = desc;
              matchedQuantity = Number(item.quantity ?? item.qty) || undefined;
              matchedPrice = Number(item.unit_price ?? item.total_usd ?? item.price) || undefined;
              matchedDoc = doc.type;
              break;
            }
          }
        }

        if (matchFound) break;

        if (matchesAnyTerm(JSON.stringify(extracted))) {
          matchFound = true;
          matchedDescription = `Document ${doc.type} (${doc.file_name})`;
          matchedDoc = doc.type;
          break;
        }
      }

      if (matchFound) {
        matchedOperations.push({
          operation: op,
          description: matchedDescription,
          quantity: matchedQuantity,
          unitPriceUsd: matchedPrice,
          sourceDocument: matchedDoc,
        });
      }
    }

    if (matchedOperations.length === 0) return [];

    const matchedIds = matchedOperations.map(({ operation }) => operation.id);
    const [allContainers, allEvents] = await Promise.all([
      this.request<ContainerRow[]>(
        `containers?operation_id=in.(${matchedIds.join(',')})&select=*`,
      ),
      this.request<EventRow[]>(
        `events?operation_id=in.(${matchedIds.join(',')})&select=*`,
      ),
    ]);
    const containersByOperation = new Map<string, ContainerRow[]>();
    const eventsByOperation = new Map<string, EventRow[]>();
    for (const container of allContainers) {
      const current = containersByOperation.get(container.operation_id) ?? [];
      current.push(container);
      containersByOperation.set(container.operation_id, current);
    }
    for (const event of allEvents) {
      const current = eventsByOperation.get(event.operation_id) ?? [];
      current.push(event);
      eventsByOperation.set(event.operation_id, current);
    }

    return matchedOperations.map(({ operation, description, quantity, unitPriceUsd, sourceDocument }) => ({
      operationId: operation.id,
      referenceCode: operation.reference_code,
      clientName: operation.client_name,
      operationStatus: operation.status,
      matchedItem: { description, quantity, unitPriceUsd, sourceDocument },
      containers: (containersByOperation.get(operation.id) ?? []).map((container) => ({
        containerNumber: container.container_number,
        status: container.status,
        currentLocation: container.current_location,
        currentVessel: container.current_vessel,
        originPort: container.origin_port || 'Por confirmar',
        destinationPort: container.destination_port || 'Por confirmar',
        eta: container.eta,
        originalEta: container.original_eta,
        actualArrival: container.actual_arrival,
        customsLight: container.customs_light ?? null,
      })),
      alerts: (eventsByOperation.get(operation.id) ?? []).map((event) => ({
        severity: event.severity,
        title: event.title,
        message: event.message,
      })),
    }));
  }
}
