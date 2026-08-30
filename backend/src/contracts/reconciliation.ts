import { z } from 'zod';

import reconciliationFindingsJsonSchema from './reconciliation-findings.schema.json' with {
  type: 'json',
};

export type ReconciliationField = 'containerNumber' | 'weightKg' | 'amountUsd';
export type ReconciliationSeverity = 'normal' | 'warning' | 'critical';

export interface ReconciliationDiscrepancy {
  field: ReconciliationField;
  severity: 'warning' | 'critical';
  values: {
    billOfLading: string | number;
    commercialInvoice: string | number;
    packingList: string | number;
  };
}

export interface ReconciliationFindingsProps {
  status: 'matched' | 'discrepancy';
  severity: ReconciliationSeverity;
  discrepancies: ReconciliationDiscrepancy[];
  evidenceIds: string[];
}

/**
 * Authoritative runtime contract for the backend catalog and frontend registry.
 * The frontend imports the dependency-free JSON Schema source directly.
 */
export const reconciliationFindingsPropsSchema = z.fromJSONSchema(
  reconciliationFindingsJsonSchema as never,
) as z.ZodType<ReconciliationFindingsProps>;
