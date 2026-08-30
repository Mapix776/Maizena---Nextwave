import { createHash } from 'node:crypto';

import type { ArtifactManifestEntry } from './authoring-runner.js';
import {
  createFrontendOriginPolicy,
  type FrontendOriginPolicy,
} from './frontend-origin-policy.js';

export interface AcceptedArtifactRevision {
  storageBucket: string;
  storagePrefix: string;
  bundleManifest: ReadonlyArray<ArtifactManifestEntry>;
}

export interface ArtifactContentRepository {
  findAcceptedRevision(
    artifactId: string,
    revisionId: string,
  ): Promise<AcceptedArtifactRevision | null>;
  download(bucket: string, path: string): Promise<Uint8Array | null>;
}

export type ArtifactContentResult =
  | { status: 404 }
  | {
      status: 200;
      bytes: Uint8Array;
      headers: Record<string, string>;
    };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safePath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith('/') &&
    !path.endsWith('/') &&
    path.split('/').every((segment) => segment && segment !== '.' && segment !== '..')
  );
}

export class ArtifactContentGateway {
  readonly #frameAncestors: string[];

  constructor(
    private readonly repository: ArtifactContentRepository,
    options: { originPolicy?: Pick<FrontendOriginPolicy, 'frameAncestors'> } = {},
  ) {
    this.#frameAncestors = [
      ...(options.originPolicy ?? createFrontendOriginPolicy()).frameAncestors,
    ];
  }

  async get(input: {
    artifactId: string;
    revisionId: string;
    path: string;
  }): Promise<ArtifactContentResult> {
    if (!UUID_PATTERN.test(input.artifactId) || !UUID_PATTERN.test(input.revisionId)) {
      return { status: 404 };
    }
    const path = input.path || 'index.html';
    if (!safePath(path)) return { status: 404 };

    const accepted = await this.repository.findAcceptedRevision(
      input.artifactId,
      input.revisionId,
    );
    if (!accepted) return { status: 404 };

    const entry = accepted.bundleManifest.find((candidate) => candidate.path === path);
    if (!entry || !safePath(entry.path)) return { status: 404 };
    const bytes = await this.repository.download(
      accepted.storageBucket,
      `${accepted.storagePrefix}/bundle/${entry.path}`,
    );
    if (
      !bytes ||
      bytes.byteLength !== entry.bytes ||
      createHash('sha256').update(bytes).digest('hex') !== entry.sha256
    ) {
      return { status: 404 };
    }

    return {
      status: 200,
      bytes,
      headers: {
        'Content-Type': entry.mimeType,
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors " +
          this.#frameAncestors.join(' '),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    };
  }
}

interface ArtifactRow {
  id: string;
  accepted_revision_id: string;
}

interface RevisionRow {
  storage_bucket: string;
  storage_prefix: string;
  bundle_manifest: ArtifactManifestEntry[];
}

export class SupabaseArtifactContentRepository implements ArtifactContentRepository {
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

  async findAcceptedRevision(
    artifactId: string,
    revisionId: string,
  ): Promise<AcceptedArtifactRevision | null> {
    if (!this.#url || !this.#serviceRoleKey) return null;
    const artifactQuery = new URLSearchParams({
      select: 'id,accepted_revision_id',
      id: `eq.${artifactId}`,
      accepted_revision_id: `eq.${revisionId}`,
      limit: '1',
    });
    const artifactResponse = await this.#fetch(
      `${this.#url}/rest/v1/report_artifacts?${artifactQuery}`,
      { headers: this.#headers() },
    );
    if (!artifactResponse.ok) return null;
    const artifacts = (await artifactResponse.json()) as ArtifactRow[];
    if (!artifacts[0]) return null;

    const revisionQuery = new URLSearchParams({
      select: 'storage_bucket,storage_prefix,bundle_manifest',
      id: `eq.${revisionId}`,
      artifact_id: `eq.${artifactId}`,
      status: 'eq.accepted',
      limit: '1',
    });
    const revisionResponse = await this.#fetch(
      `${this.#url}/rest/v1/report_artifact_revisions?${revisionQuery}`,
      { headers: this.#headers() },
    );
    if (!revisionResponse.ok) return null;
    const revisions = (await revisionResponse.json()) as RevisionRow[];
    const row = revisions[0];
    if (!row || !Array.isArray(row.bundle_manifest)) return null;
    return {
      storageBucket: row.storage_bucket,
      storagePrefix: row.storage_prefix,
      bundleManifest: row.bundle_manifest,
    };
  }

  async download(bucket: string, path: string): Promise<Uint8Array | null> {
    if (!this.#url || !this.#serviceRoleKey) return null;
    const response = await this.#fetch(
      `${this.#url}/storage/v1/object/${encodeURIComponent(bucket)}/${path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
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
