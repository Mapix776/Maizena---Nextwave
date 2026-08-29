import { z } from 'zod';

const operationStatusSchema = z.enum([
  'BOOKED',
  'IN_TRANSIT',
  'AT_PORT',
  'CUSTOMS_CLEARANCE',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'EXCEPTION',
]);

/** The only shape the AI is allowed to persist in the operations table. */
export const createOperationInputSchema = z
  .object({
    clientName: z.string().trim().min(1).max(200),
    referenceCode: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, 'Use a safe reference code.'),
    status: operationStatusSchema.default('BOOKED'),
    canonicalData: z.record(z.string(), z.unknown()).default({}),
    tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
    notes: z.string().trim().max(4_000).nullable().default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if (JSON.stringify(value.canonicalData).length > 16_000) {
      context.addIssue({
        code: 'custom',
        path: ['canonicalData'],
        message: 'canonicalData must be at most 16 KB when serialized.',
      });
    }
  });

export type CreateOperationInput = z.infer<typeof createOperationInputSchema>;

export interface CreatedOperation {
  id: string;
  clientName: string;
  referenceCode: string;
  status: z.infer<typeof operationStatusSchema>;
  createdAt: string;
}

export interface OperationWriter {
  create(input: CreateOperationInput): Promise<CreatedOperation>;
}

interface SupabaseOperationRow {
  id: string;
  client_name: string;
  reference_code: string;
  status: z.infer<typeof operationStatusSchema>;
  created_at: string;
}

export class SupabaseOperationWriter implements OperationWriter {
  readonly #url: string;
  readonly #serviceRoleKey: string;
  readonly #fetch: typeof fetch;

  constructor(options: {
    url?: string;
    serviceRoleKey?: string;
    fetch?: typeof fetch;
  } = {}) {
    this.#url = (options.url ?? process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
    this.#serviceRoleKey =
      options.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async create(input: CreateOperationInput): Promise<CreatedOperation> {
    if (!this.#url || !this.#serviceRoleKey) {
      throw new Error(
        'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend.',
      );
    }

    const response = await this.#fetch(`${this.#url}/rest/v1/operations`, {
      method: 'POST',
      headers: {
        apikey: this.#serviceRoleKey,
        Authorization: `Bearer ${this.#serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        client_name: input.clientName,
        reference_code: input.referenceCode,
        status: input.status,
        canonical_data: input.canonicalData,
        tags: input.tags,
        notes: input.notes,
      }),
    });

    if (!response.ok) {
      const details = (await response.text()).slice(0, 1_000);
      throw new Error(`Supabase could not create the operation (${response.status}): ${details}`);
    }

    const rows = (await response.json()) as SupabaseOperationRow[];
    const row = rows[0];
    if (!row) {
      throw new Error('Supabase created no operation record.');
    }

    return {
      id: row.id,
      clientName: row.client_name,
      referenceCode: row.reference_code,
      status: row.status,
      createdAt: row.created_at,
    };
  }
}
