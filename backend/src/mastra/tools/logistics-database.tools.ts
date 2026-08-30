import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  cargoItemSearchResultSchema,
  containerRowSchema,
  decisionRowSchema,
  eventRowSchema,
  operationFullDetailsSchema,
  operationRowSchema,
  operationsMetricsSummarySchema,
  universalSearchResultSchema,
} from '../../contracts/database-rows.js';
import { SupabaseReader } from '../../services/supabase-reader.js';

export interface LogisticsToolsOptions {
  reader?: SupabaseReader;
}

export const searchCargoOutputSchema = z
  .object({
    matchedCount: z.number().int().nonnegative(),
    results: z.array(cargoItemSearchResultSchema),
  })
  .strict();

export const operationDetailsOutputSchema = z
  .object({
    found: z.boolean(),
    details: operationFullDetailsSchema.nullable(),
  })
  .strict();

export const operationsListOutputSchema = z
  .object({
    count: z.number().int().nonnegative(),
    operations: z.array(operationRowSchema),
  })
  .strict();

export const containerStatusOutputSchema = z
  .object({
    found: z.boolean(),
    container: containerRowSchema.nullable(),
  })
  .strict();

export const customsStatusOutputSchema = z
  .object({
    count: z.number().int().nonnegative(),
    containers: z.array(containerRowSchema),
  })
  .strict();

export const operationalAlertsOutputSchema = z
  .object({
    count: z.number().int().nonnegative(),
    alerts: z.array(eventRowSchema),
  })
  .strict();

export const pendingDecisionsOutputSchema = z
  .object({
    count: z.number().int().nonnegative(),
    decisions: z.array(decisionRowSchema),
  })
  .strict();

export const operationsSummaryOutputSchema = z
  .object({ summary: operationsMetricsSummarySchema })
  .strict();

export const universalSearchOutputSchema = z
  .object({ results: universalSearchResultSchema })
  .strict();

/**
 * 1. Deep search for specific cargo items or products
 */
export function createSearchCargoTool(options: LogisticsToolsOptions = {}) {
  const reader = options.reader ?? new SupabaseReader();
  return createTool({
    id: 'search-cargo-items',
    description:
      'Search for specific products, merchandise, or cargo items (e.g. "dining tables", "furniture", "auto parts", "pharma", "electronics") across commercial documents (Invoices, Packing Lists, POs), tags, and operations. Returns exact delivery status, containers, vessels, and estimated or actual arrival dates.',
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe('Product name, merchandise description, or cargo keyword to search for (e.g. "dining tables", "furniture", "electronics").'),
    }),
    outputSchema: searchCargoOutputSchema,
    execute: async ({ query }) => {
      const results = await reader.searchCargoItems(query);
      return {
        matchedCount: results.length,
        results,
      };
    },
  });
}

/**
 * 2. 360-degree operational view of a shipment by reference code or UUID
 */
export function createGetOperationDetailsTool(options: LogisticsToolsOptions = {}) {
  const reader = options.reader ?? new SupabaseReader();
  return createTool({
    id: 'get-operation-details',
    description:
      'Retrieve comprehensive 360-degree operational details for a shipment using its reference code (e.g. "OP-2026-101", "OP-2026-102") or UUID. Includes operation status, containers, documents, alerts, human-in-the-loop decisions, and parties.',
    inputSchema: z.object({
      referenceCodeOrId: z
        .string()
        .min(1)
        .describe('Operation reference code (e.g. "OP-2026-101", "OP-2026-102") or UUID.'),
    }),
    outputSchema: operationDetailsOutputSchema,
    execute: async ({ referenceCodeOrId }) => {
      const details = await reader.getOperationFullDetails(referenceCodeOrId);
      return {
        found: details !== null,
        details,
      };
    },
  });
}

/**
 * 3. List shipments with optional filters
 */
export function createListOperationsTool(options: LogisticsToolsOptions = {}) {
  const reader = options.reader ?? new SupabaseReader();
  return createTool({
    id: 'list-operations',
    description:
      'List logistics operations/shipments with optional filters by status (e.g. BOOKED, IN_TRANSIT, AT_PORT, CUSTOMS_CLEARANCE, DELIVERED, EXCEPTION), client name, or tag.',
    inputSchema: z.object({
      status: z
        .enum([
          'BOOKED',
          'IN_TRANSIT',
          'AT_PORT',
          'CUSTOMS_CLEARANCE',
          'OUT_FOR_DELIVERY',
          'DELIVERED',
          'EXCEPTION',
        ])
        .optional()
        .describe('Filter by operation status.'),
      clientName: z
        .string()
        .optional()
        .describe('Filter by client company name (e.g. "Muebles del Sur", "AutoParts Latam", "TechLogistics Inc.").'),
      tag: z
        .string()
        .optional()
        .describe('Filter by tag (e.g. "VIP", "Perishables", "Automotive", "Electronics").'),
      limit: z.number().int().min(1).max(100).default(20).optional(),
    }),
    outputSchema: operationsListOutputSchema,
    execute: async (input) => {
      const operations = await reader.listOperations({
        status: input.status,
        clientName: input.clientName,
        tag: input.tag,
        limit: input.limit,
      });
      return {
        count: operations.length,
        operations,
      };
    },
  });
}

/**
 * 4. Track container by ISO number
 */
export function createGetContainerStatusTool(options: LogisticsToolsOptions = {}) {
  const reader = options.reader ?? new SupabaseReader();
  return createTool({
    id: 'get-container-status',
    description:
      'Track a specific container by its ISO container number (e.g. "MSKU1234567", "CMAU9876543"). Returns real-time location, vessel, ports, ETA vs original ETA, and customs status.',
    inputSchema: z.object({
      containerNumber: z
        .string()
        .min(1)
        .describe('Standard container identifier (e.g. "MSKU1234567").'),
    }),
    outputSchema: containerStatusOutputSchema,
    execute: async ({ containerNumber }) => {
      const container = await reader.getEnrichedContainerByNumber(containerNumber);
      return {
        found: container !== null,
        container,
      };
    },
  });
}

/**
 * 5. Customs status and physical inspection query
 */
export function createGetCustomsStatusTool(options: LogisticsToolsOptions = {}) {
  const reader = options.reader ?? new SupabaseReader();
  return createTool({
    id: 'get-customs-status',
    description:
      'Query customs clearance status, physical inspections ("previo"), pedimento numbers, and customs traffic light results (green = immediate release, red = mandatory inspection).',
    inputSchema: z.object({
      customsLight: z
        .enum(['green', 'red', 'pending'])
        .optional()
        .describe('Filter by customs traffic light result (green, red, or pending).'),
      onlyWithPedimento: z
        .boolean()
        .optional()
        .describe('Filter only containers with a validated customs pedimento number.'),
      onlyWithPrevioCompleted: z
        .boolean()
        .optional()
        .describe('Filter only containers where physical inspection ("previo") is completed.'),
    }),
    outputSchema: customsStatusOutputSchema,
    execute: async (input) => {
      let containers;
      if (input.customsLight) {
        containers = await reader.getContainersByCustomsLight(input.customsLight);
      } else if (input.onlyWithPedimento) {
        containers = await reader.getContainersWithPedimento();
      } else if (input.onlyWithPrevioCompleted) {
        containers = await reader.getContainersWithPrevioCompleted();
      } else {
        containers = await reader.getContainersByStatus('CUSTOMS_HOLD');
      }
      return {
        count: containers.length,
        containers,
      };
    },
  });
}

/**
 * 6. Query operational events and critical alerts
 */
export function createGetOperationalAlertsTool(options: LogisticsToolsOptions = {}) {
  const reader = options.reader ?? new SupabaseReader();
  return createTool({
    id: 'get-operational-alerts',
    description:
      'Retrieve active operational alerts, delays (ETA slips), document discrepancies, and risk warnings.',
    inputSchema: z.object({
      severity: z
        .enum(['NORMAL', 'WARNING', 'CRITICAL'])
        .optional()
        .describe('Filter by severity level (NORMAL, WARNING, CRITICAL).'),
      unacknowledgedOnly: z
        .boolean()
        .default(true)
        .optional()
        .describe('Only return unacknowledged/unresolved alerts.'),
      limit: z.number().int().min(1).max(50).default(20).optional(),
    }),
    outputSchema: operationalAlertsOutputSchema,
    execute: async (input) => {
      const alerts = await reader.getEvents({
        severity: input.severity,
        unacknowledgedOnly: input.unacknowledgedOnly,
        limit: input.limit,
      });
      return {
        count: alerts.length,
        alerts,
      };
    },
  });
}

/**
 * 7. Query pending Human-in-the-Loop decisions
 */
export function createGetPendingDecisionsTool(options: LogisticsToolsOptions = {}) {
  const reader = options.reader ?? new SupabaseReader();
  return createTool({
    id: 'get-pending-decisions',
    description:
      'Retrieve pending human-in-the-loop decisions waiting for user approval or resolution (e.g. rerouting approval, discrepancy resolution, customs escalation). Pass operationIdOrRef to get decisions for a specific shipment (e.g. "OP-2026-9201" or UUID).',
    inputSchema: z.object({
      operationIdOrRef: z
        .string()
        .optional()
        .describe('Optional operation reference code (e.g. "OP-2026-9201") or UUID to filter pending decisions.'),
      operationId: z
        .string()
        .optional()
        .describe('Legacy alias for operation UUID or reference code.'),
    }),
    outputSchema: pendingDecisionsOutputSchema,
    execute: async (input) => {
      const targetOp = input.operationIdOrRef || input.operationId;
      const decisions = await reader.getPendingDecisions(targetOp);
      return {
        count: decisions.length,
        decisions,
      };
    },
  });
}

/**
 * 8. Global logistics real-time metrics summary
 */
export function createGetOperationsSummaryTool(options: LogisticsToolsOptions = {}) {
  const reader = options.reader ?? new SupabaseReader();
  return createTool({
    id: 'get-operations-summary',
    description:
      'Get global real-time logistics metrics: total active shipments, breakdown by status, delayed containers count, critical alerts count, and pending human decisions.',
    inputSchema: z.object({}),
    outputSchema: operationsSummaryOutputSchema,
    execute: async () => {
      const summary = await reader.getOperationsMetricsSummary();
      return { summary };
    },
  });
}

/**
 * 9. Universal global search
 */
export function createUniversalSearchTool(options: LogisticsToolsOptions = {}) {
  const reader = options.reader ?? new SupabaseReader();
  return createTool({
    id: 'universal-logistics-search',
    description:
      'Universal global search across operations, containers, vessels, ports, documents, parties, alerts, and decisions in a single call.',
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe('Search query keyword (vessel name, port, client, document ID, container number).'),
    }),
    outputSchema: universalSearchOutputSchema,
    execute: async ({ query }) => {
      const results = await reader.universalSearch(query);
      return { results };
    },
  });
}
