import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AcceptedUploadedDocumentTypeSchema } from '../../contracts/domain.js';
import { DocumentExtractorService } from '../../services/document-extractor.js';

export interface IngestDocumentToolOptions {
  extractor?: DocumentExtractorService;
}

export function createIngestDocumentTool(options: IngestDocumentToolOptions = {}) {
  const extractor = options.extractor ?? new DocumentExtractorService();
  return createTool({
    id: 'ingest-uploaded-document',
    description:
      'The sole Ari data-mutation tool. Use only after the user has uploaded or pasted a Purchase Order, Booking Confirmation, Bill of Lading, Packing List, or Arrival Notice. It validates the extracted/OCR text before adding structured logistics facts to Supabase. Reject every other document type and never use it for conversational edits.',
    inputSchema: z.object({
      fileName: z
        .string()
        .min(1)
        .describe('Name of the uploaded file (e.g. "Booking_Confirmation_VN2026.pdf", "Invoice_Muebles.docx").'),
      fileContentText: z
        .string()
        .min(1)
        .describe('Extracted raw text or OCR content from the uploaded document; required for validation.'),
      operationReference: z
        .string()
        .optional()
        .describe('Optional existing operation reference to attach this document to (e.g. "OP-2026-101").'),
      documentType: AcceptedUploadedDocumentTypeSchema
        .optional()
        .describe('Optional type only when it matches the document content. Allowed: Purchase Order, Booking Confirmation, Bill of Lading, Packing List, Arrival Notice.'),
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
