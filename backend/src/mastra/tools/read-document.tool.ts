import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { SupabaseReader } from '../../services/supabase-reader.js';

export interface ReadDocumentToolOptions {
  reader?: SupabaseReader;
}

export function createReadDocumentTool(options: ReadDocumentToolOptions = {}) {
  const reader = options.reader ?? new SupabaseReader();
  return createTool({
    id: 'read-shipment-document',
    description:
      'Read and parse shipment documents (Bill of Lading, Commercial Invoice, Packing List, Pedimento, Purchase Order) for an operation. Extracts facts, weights, amounts, items, and references.',
    inputSchema: z.object({
      operationIdOrRef: z
        .string()
        .min(1)
        .describe('Operation reference code (e.g. "OP-2026-101") or UUID.'),
      documentType: z
        .enum([
          'BILL_OF_LADING',
          'COMMERCIAL_INVOICE',
          'PACKING_LIST',
          'PURCHASE_ORDER',
          'PEDIMENTO',
          'ARRIVAL_NOTICE',
          'CUSTOMS_DECLARATION',
        ])
        .optional()
        .describe('Optional document type filter.'),
      documentReference: z
        .string()
        .optional()
        .describe('Optional exact document number or printed reference code.'),
    }),
    outputSchema: z.object({
      found: z.boolean(),
      count: z.number(),
      documents: z.array(z.any()),
    }),
    execute: async (input) => {
      if (input.documentReference) {
        const doc = await reader.getDocumentByReference(input.documentReference);
        return {
          found: doc !== null,
          count: doc ? 1 : 0,
          documents: doc ? [doc] : [],
        };
      }

      const op = await reader.getOperationByReferenceOrId(input.operationIdOrRef);
      if (!op) {
        return { found: false, count: 0, documents: [] };
      }

      const docs = await reader.getDocumentsByOperation(op.id, input.documentType);
      return {
        found: docs.length > 0,
        count: docs.length,
        documents: docs,
      };
    },
  });
}
