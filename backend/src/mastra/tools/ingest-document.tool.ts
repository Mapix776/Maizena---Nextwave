import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { DocumentExtractorService } from '../../services/document-extractor.js';

export interface IngestDocumentToolOptions {
  extractor?: DocumentExtractorService;
}

export function createIngestDocumentTool(options: IngestDocumentToolOptions = {}) {
  const extractor = options.extractor ?? new DocumentExtractorService();
  return createTool({
    id: 'ingest-uploaded-document',
    description:
      'Process and ingest an uploaded document (PDF, Word, TXT, or scan) from user input. Extracts structured logistics facts (document type, reference numbers, containers, weights, line items, origin/destination ports) and stores them in Supabase.',
    inputSchema: z.object({
      fileName: z
        .string()
        .min(1)
        .describe('Name of the uploaded file (e.g. "Booking_Confirmation_VN2026.pdf", "Invoice_Muebles.docx").'),
      fileContentText: z
        .string()
        .optional()
        .describe('Extracted raw text or OCR content from the uploaded document.'),
      operationReference: z
        .string()
        .optional()
        .describe('Optional existing operation reference to attach this document to (e.g. "OP-2026-101").'),
      documentType: z
        .enum([
          'BOOKING_CONFIRMATION',
          'BILL_OF_LADING',
          'COMMERCIAL_INVOICE',
          'PACKING_LIST',
          'PURCHASE_ORDER',
          'PEDIMENTO',
          'ARRIVAL_NOTICE',
          'CUSTOMS_DECLARATION',
          'OTHER',
        ])
        .optional()
        .describe('Optional explicitly identified document type.'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      documentId: z.string(),
      operationReference: z.string(),
      documentType: z.string(),
      containersCount: z.number(),
      itemsCount: z.number(),
      summary: z.string(),
    }),
    execute: async (input) => {
      const result = await extractor.ingestDocument({
        fileName: input.fileName,
        fileContentText: input.fileContentText,
        operationIdOrRef: input.operationReference,
        overrideData: input.documentType ? { documentType: input.documentType } : undefined,
      });

      const summary = `Successfully uploaded and processed ${result.documentType} (${input.fileName}). Extracted ${result.containersCount} container(s) and ${result.itemsCount} merchandise item(s) for operation ${result.operationReference}.`;

      return {
        success: result.success,
        documentId: result.documentId,
        operationReference: result.operationReference,
        documentType: result.documentType,
        containersCount: result.containersCount,
        itemsCount: result.itemsCount,
        summary,
      };
    },
  });
}
