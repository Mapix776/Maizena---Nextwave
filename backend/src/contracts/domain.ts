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
  'ARRIVAL_NOTICE',
  'BL_REVALIDATION',
  'PREVIO_REPORT',
  'PEDIMENTO',
  'DELIVERY_ORDER',
  'EXPENSE_ACCOUNT',
  'OTHER',
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

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
