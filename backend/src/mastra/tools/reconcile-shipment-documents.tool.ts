import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const documentFactsSchema = z
  .object({
    containerNumber: z.string().trim().min(1).max(20),
    weightKg: z.number().nonnegative(),
    amountUsd: z.number().nonnegative(),
  })
  .strict();

export const reconcileShipmentDocumentsInputSchema = z
  .object({
    billOfLading: documentFactsSchema,
    commercialInvoice: documentFactsSchema,
    packingList: documentFactsSchema,
  })
  .strict();

const discrepancySchema = z
  .object({
    field: z.enum(['containerNumber', 'weightKg', 'amountUsd']),
    severity: z.enum(['warning', 'critical']),
    values: z.object({
      billOfLading: z.union([z.string(), z.number()]),
      commercialInvoice: z.union([z.string(), z.number()]),
      packingList: z.union([z.string(), z.number()]),
    }),
  })
  .strict();

export const reconcileShipmentDocumentsOutputSchema = z
  .object({
    status: z.enum(['matched', 'discrepancy']),
    severity: z.enum(['normal', 'warning', 'critical']),
    discrepancies: z.array(discrepancySchema),
  })
  .strict();

type ReconciliationInput = z.infer<
  typeof reconcileShipmentDocumentsInputSchema
>;
export type ReconciliationOutput = z.infer<
  typeof reconcileShipmentDocumentsOutputSchema
>;
type ReconciliationField = 'containerNumber' | 'weightKg' | 'amountUsd';

export function reconcileShipmentDocuments(
  input: ReconciliationInput,
): ReconciliationOutput {
  const discrepancies: ReconciliationOutput['discrepancies'] = [];

  for (const field of [
    'containerNumber',
    'weightKg',
    'amountUsd',
  ] as const satisfies readonly ReconciliationField[]) {
    const values = {
      billOfLading: input.billOfLading[field],
      commercialInvoice: input.commercialInvoice[field],
      packingList: input.packingList[field],
    };

    if (new Set(Object.values(values)).size > 1) {
      discrepancies.push({
        field,
        severity: field === 'containerNumber' ? 'critical' : 'warning',
        values,
      });
    }
  }

  return {
    status: discrepancies.length === 0 ? 'matched' : 'discrepancy',
    severity: discrepancies.some(({ severity }) => severity === 'critical')
      ? 'critical'
      : discrepancies.length > 0
        ? 'warning'
        : 'normal',
    discrepancies,
  };
}

export function createReconcileShipmentDocumentsTool() {
  return createTool({
    id: 'reconcile-shipment-documents',
    description:
      'Compare a Bill of Lading, Commercial Invoice, and Packing List by container number, weight, and amount.',
    inputSchema: reconcileShipmentDocumentsInputSchema,
    outputSchema: reconcileShipmentDocumentsOutputSchema,
    execute: async (input) => reconcileShipmentDocuments(input),
  });
}
