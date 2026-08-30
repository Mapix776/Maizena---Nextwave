import { z } from 'zod';

/** Payload the frontend sends when persisting an AI-generated trade document. */
export const saveDocumentInputSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    type: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(300),
    reference: z.string().trim().max(200).nullable().default(null),
    props: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()
  .superRefine((value, context) => {
    if (JSON.stringify(value.props).length > 64_000) {
      context.addIssue({
        code: 'custom',
        path: ['props'],
        message: 'props must be at most 64 KB when serialized.',
      });
    }
  });

export type SaveDocumentInput = z.infer<typeof saveDocumentInputSchema>;

export interface SavedDocument {
  path: string;
  url: string;
  bucket: string;
}

/** Turns an arbitrary id/reference into a filesystem-safe object key. */
function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 160);
}

export class SupabaseDocumentStore {
  readonly #url: string;
  readonly #serviceRoleKey: string;
  readonly #bucket: string;
  readonly #fetch: typeof fetch;

  constructor(
    options: {
      url?: string;
      serviceRoleKey?: string;
      bucket?: string;
      fetch?: typeof fetch;
    } = {},
  ) {
    this.#url = (options.url ?? process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
    this.#serviceRoleKey =
      options.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    this.#bucket = options.bucket ?? process.env.SUPABASE_DOCUMENTS_BUCKET ?? 'documents';
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async save(input: SaveDocumentInput): Promise<SavedDocument> {
    if (!this.#url || !this.#serviceRoleKey) {
      throw new Error(
        'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend.',
      );
    }

    const reference = input.reference ? safeSegment(input.reference) : safeSegment(input.id);
    const path = `${safeSegment(input.type).toLowerCase()}/${reference}.json`;
    const body = JSON.stringify(
      {
        id: input.id,
        type: input.type,
        title: input.title,
        reference: input.reference,
        props: input.props,
        generatedBy: 'ari-ai',
        savedAt: new Date().toISOString(),
      },
      null,
      2,
    );

    const response = await this.#fetch(
      `${this.#url}/storage/v1/object/${this.#bucket}/${path}`,
      {
        method: 'POST',
        headers: {
          apikey: this.#serviceRoleKey,
          Authorization: `Bearer ${this.#serviceRoleKey}`,
          'Content-Type': 'application/json',
          'x-upsert': 'true',
        },
        body,
      },
    );

    if (!response.ok) {
      const details = (await response.text()).slice(0, 1_000);
      throw new Error(`Supabase Storage could not save the document (${response.status}): ${details}`);
    }

    return {
      path,
      bucket: this.#bucket,
      url: `${this.#url}/storage/v1/object/public/${this.#bucket}/${path}`,
    };
  }
}
