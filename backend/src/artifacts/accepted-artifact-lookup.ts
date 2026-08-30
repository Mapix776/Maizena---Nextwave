import type {
  AcceptedArtifactLookup,
  ReportArtifactDescriptor,
} from './artifact-contracts.js';

interface AcceptedArtifactRow {
  artifact_id: string;
  revision_id: string;
  title: string;
  created_at: string;
}

export class SupabaseAcceptedArtifactLookup implements AcceptedArtifactLookup {
  readonly #url: string;
  readonly #serviceRoleKey: string;
  readonly #publicBaseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(options: {
    url?: string;
    serviceRoleKey?: string;
    publicBaseUrl?: string;
    fetch?: typeof fetch;
  } = {}) {
    this.#url = (options.url ?? process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
    this.#serviceRoleKey =
      options.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    this.#publicBaseUrl = (
      options.publicBaseUrl ??
      process.env.BACKEND_PUBLIC_URL ??
      process.env.RENDER_EXTERNAL_URL ??
      'http://localhost:3001'
    ).replace(/\/$/, '');
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async findByRequestId(requestId: string): Promise<ReportArtifactDescriptor | null> {
    if (!this.#url || !this.#serviceRoleKey) {
      throw new Error(
        'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend.',
      );
    }
    if (!requestId || requestId.length > 128) {
      throw new Error('Request ID must be between 1 and 128 characters');
    }

    const response = await this.#fetch(
      `${this.#url}/rest/v1/rpc/find_accepted_report_artifact_by_request_id`,
      {
        method: 'POST',
        headers: {
          apikey: this.#serviceRoleKey,
          Authorization: `Bearer ${this.#serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_request_id: requestId }),
      },
    );
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1_000);
      throw new Error(`Accepted artifact lookup failed (${response.status}): ${detail}`);
    }
    const payload = (await response.json()) as AcceptedArtifactRow[];
    const row = payload[0];
    if (!row) return null;

    return {
      artifactId: row.artifact_id,
      revisionId: row.revision_id,
      kind: 'custom-report',
      title: row.title,
      status: 'accepted',
      previewUrl: `${this.#publicBaseUrl}/api/artifacts/${row.artifact_id}/revisions/${row.revision_id}/content/`,
      createdAt: row.created_at,
    };
  }
}
