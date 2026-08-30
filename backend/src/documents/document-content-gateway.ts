import {
  createFrontendOriginPolicy,
  type FrontendOriginPolicy,
} from '../artifacts/frontend-origin-policy.js';

export interface StoredPdfDocument {
  fileName: string;
  mimeType: string;
  storageBucket: string;
  storagePath: string;
}

export interface DocumentContentRepository {
  findStoredDocument(documentId: string): Promise<StoredPdfDocument | null>;
  download(bucket: string, path: string): Promise<Uint8Array | null>;
}

export type DocumentContentResult =
  | { status: 404 }
  | { status: 200; bytes: Uint8Array; headers: Record<string, string> };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function disposition(fileName: string): string {
  const safeAscii = fileName.replace(/[^A-Za-z0-9._ -]/g, '_').replace(/["\\]/g, '_') || 'document.pdf';
  return `inline; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export class DocumentContentGateway {
  readonly #frameAncestors: readonly string[];

  constructor(
    private readonly repository: DocumentContentRepository,
    options: { originPolicy?: Pick<FrontendOriginPolicy, 'frameAncestors'> } = {},
  ) {
    this.#frameAncestors =
      (options.originPolicy ?? createFrontendOriginPolicy()).frameAncestors;
  }

  async get(documentId: string): Promise<DocumentContentResult> {
    if (!UUID_PATTERN.test(documentId)) return { status: 404 };
    const document = await this.repository.findStoredDocument(documentId);
    if (!document || document.mimeType !== 'application/pdf') return { status: 404 };
    const bytes = await this.repository.download(
      document.storageBucket,
      document.storagePath,
    );
    if (!bytes) return { status: 404 };
    return {
      status: 200,
      bytes,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition(document.fileName),
        'Content-Security-Policy': `frame-ancestors ${this.#frameAncestors.join(' ')}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    };
  }
}

interface DocumentRow {
  file_name: string;
  mime_type: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
}

export class SupabaseDocumentContentRepository implements DocumentContentRepository {
  readonly #url: string;
  readonly #serviceRoleKey: string;
  readonly #fetch: typeof fetch;

  constructor(options: { url?: string; serviceRoleKey?: string; fetch?: typeof fetch } = {}) {
    this.#url = (options.url ?? process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
    this.#serviceRoleKey = options.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async findStoredDocument(documentId: string): Promise<StoredPdfDocument | null> {
    if (!this.#url || !this.#serviceRoleKey) return null;
    const query = new URLSearchParams({
      select: 'file_name,mime_type,storage_bucket,storage_path',
      id: `eq.${documentId}`,
      limit: '1',
    });
    const response = await this.#fetch(`${this.#url}/rest/v1/documents?${query}`, {
      headers: this.#headers(),
    });
    if (!response.ok) return null;
    const row = ((await response.json()) as DocumentRow[])[0];
    if (!row?.storage_bucket || !row.storage_path || !row.mime_type || !row.file_name) return null;
    return {
      fileName: row.file_name,
      mimeType: row.mime_type,
      storageBucket: row.storage_bucket,
      storagePath: row.storage_path,
    };
  }

  async download(bucket: string, path: string): Promise<Uint8Array | null> {
    if (!this.#url || !this.#serviceRoleKey) return null;
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const response = await this.#fetch(
      `${this.#url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`,
      { headers: this.#headers() },
    );
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  }

  #headers(): Record<string, string> {
    return {
      apikey: this.#serviceRoleKey,
      Authorization: `Bearer ${this.#serviceRoleKey}`,
    };
  }
}
