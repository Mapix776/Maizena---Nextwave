import { z } from 'zod';

/**
 * Nauta Logistics Domain Model
 * Reference: docs/dominio-logistica-nauta.md
 */

export const DocumentTypeSchema = z.enum([
  'PURCHASE_ORDER',
  'BOOKING_CONFIRMATION',
  'BILL_OF_LADING',
  'COMMERCIAL_INVOICE',
  'PACKING_LIST',
  'CUSTOMS_DECLARATION',
  'EMAIL_UPDATE',
  'ARRIVAL_NOTICE',
  'BL_REVALIDATION',
  'PREVIO_REPORT',
  'PEDIMENTO',
  'DELIVERY_ORDER',
  'EXPENSE_ACCOUNT',
  'OTHER',
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const DocumentPartyRoleSchema = z.enum([
  'ISSUER',
  'BUYER',
  'SUPPLIER',
  'SHIPPER',
  'CONSIGNEE',
  'CARRIER',
  'NOTIFY_PARTY',
]);
export type DocumentPartyRole = z.infer<typeof DocumentPartyRoleSchema>;

export const DocumentPartySchema = z
  .object({
    partyRole: DocumentPartyRoleSchema,
    partyName: z.string().trim().min(1).max(200),
    partyReference: z.string().trim().min(1).max(100).nullable().default(null),
    details: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type DocumentParty = z.infer<typeof DocumentPartySchema>;

/** Business association required when a file is registered as a document. */
export const DocumentAssociationSchema = z
  .object({
    operationId: z.string().uuid(),
    documentType: DocumentTypeSchema,
    documentReference: z.string().trim().min(1).max(120).nullable().default(null),
    parties: z.array(DocumentPartySchema).max(12).default([]),
  })
  .strict();
export type DocumentAssociation = z.infer<typeof DocumentAssociationSchema>;

export const documentStorageFolderByType: Record<DocumentType, string> = {
  PURCHASE_ORDER: 'purchase-orders',
  BOOKING_CONFIRMATION: 'booking-confirmations',
  BILL_OF_LADING: 'bills-of-lading',
  COMMERCIAL_INVOICE: 'commercial-invoices',
  PACKING_LIST: 'packing-lists',
  CUSTOMS_DECLARATION: 'customs-declarations',
  EMAIL_UPDATE: 'email-updates',
  ARRIVAL_NOTICE: 'arrival-notices',
  BL_REVALIDATION: 'bl-revalidations',
  PREVIO_REPORT: 'previo-reports',
  PEDIMENTO: 'pedimentos',
  DELIVERY_ORDER: 'delivery-orders',
  EXPENSE_ACCOUNT: 'expense-accounts',
  OTHER: 'other',
};

const storageFileNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(
    (fileName) => !fileName.includes('/') && !fileName.includes('\\') && !fileName.includes('..'),
    'fileName must be a plain file name without path segments.',
  );

export const documentStoragePathInputSchema = z
  .object({
    operationId: z.string().uuid(),
    documentType: DocumentTypeSchema,
    fileName: storageFileNameSchema,
  })
  .strict();

/** Canonical private object path for every uploaded logistics document. */
export function buildDocumentStoragePath(input: unknown): string {
  const { operationId, documentType, fileName } = documentStoragePathInputSchema.parse(input);
  return `operations/${operationId}/${documentStorageFolderByType[documentType]}/${fileName}`;
}

export const CustomsLightSchema = z.enum(['green', 'red', 'pending']);
export type CustomsLight = z.infer<typeof CustomsLightSchema>;

export const EventCategorySchema = z.enum([
  'bl_revalidation',
  'previo_scheduled',
  'previo_completed',
  'pedimento_validated',
  'customs_light_assigned',
  'eta_delay',
  'route_update',
  'reconciliation_discrepancy',
  'demurrage_risk',
  'general_status_change',
]);
export type EventCategory = z.infer<typeof EventCategorySchema>;

export const DecisionActionTypeSchema = z.enum([
  'customs_red_light_escalation',
  'document_discrepancy_override',
  'demurrage_prevention_expedite',
  'route_change_approval',
]);
export type DecisionActionType = z.infer<typeof DecisionActionTypeSchema>;
