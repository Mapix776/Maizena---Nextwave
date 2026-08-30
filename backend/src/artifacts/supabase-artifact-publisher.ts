import { randomUUID } from 'node:crypto';

import type { AuthoringResult, ArtifactManifestEntry } from './authoring-runner.js';
import type { ReportArtifactDescriptor } from './artifact-contracts.js';

export interface PublishArtifactInput {
  requestId: string;
  title: string;
  sourceReference: string;
  templateAlias: string;
  authoring: AuthoringResult;
}

export interface ArtifactPublisher {
  publish(input: PublishArtifactInput): Promise<ReportArtifactDescriptor>;
}

interface AcceptanceRow {
  artifact_id: string;
  revision_id: string;
  title: string;
  created_at: string;
}

function encodeObjectPath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function assertManifestPath(path: string): void {
  if (
    !path ||
    path.startsWith('/') ||
    path.endsWith('/') ||
    path.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error(`Unsafe artifact path: ${path}`);
  }
}

function manifestJson(manifest: ReadonlyArray<ArtifactManifestEntry>) {
  return manifest.map(({ path, mimeType, bytes, sha256 }) => ({
    path,
    mimeType,
    bytes,
    sha256,
  }));
}

const STORAGE_BASE_MEDIA_TYPES = new Set([
  'application/json',
  'text/css',
  'text/html',
  'text/javascript',
]);

function storageUploadContentType(mimeType: string): string {
  const baseMediaType = mimeType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return STORAGE_BASE_MEDIA_TYPES.has(baseMediaType) ? baseMediaType : mimeType;
}

export class SupabaseArtifactPublisher implements ArtifactPublisher {
  readonly #url: string;
  readonly #serviceRoleKey: string;
  readonly #bucket: string;
  readonly #publicBaseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #createId: () => string;

  constructor(options: {
    url?: string;
    serviceRoleKey?: string;
    bucket?: string;
    publicBaseUrl?: string;
    fetch?: typeof fetch;
    createId?: () => string;
  } = {}) {
    this.#url = (options.url ?? process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
    this.#serviceRoleKey =
      options.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    this.#bucket =
      options.bucket ?? process.env.SUPABASE_REPORT_ARTIFACTS_BUCKET ?? 'report-artifacts';
    this.#publicBaseUrl = (
      options.publicBaseUrl ??
      process.env.BACKEND_PUBLIC_URL ??
      process.env.RENDER_EXTERNAL_URL ??
      'http://localhost:3001'
    ).replace(/\/$/, '');
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#createId = options.createId ?? randomUUID;
  }

  async publish(input: PublishArtifactInput): Promise<ReportArtifactDescriptor> {
    if (!this.#url || !this.#serviceRoleKey) {
      throw new Error(
        'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend.',
      );
    }
    if (input.authoring.verdict !== 'accepted' || input.authoring.cleanup !== 'confirmed') {
      throw new Error('Only an accepted, cleaned-up authoring result can be published');
    }

    const artifactId = this.#createId();
    const revisionId = this.#createId();
    const storagePrefix = `artifacts/${artifactId}/revisions/${revisionId}`;

    for (const file of input.authoring.source.files) {
      assertManifestPath(file.path);
      const entry = input.authoring.source.manifest.find(({ path }) => path === file.path);
      if (!entry) throw new Error(`Source manifest is missing: ${file.path}`);
      await this.#upload(`${storagePrefix}/source/${file.path}`, entry.mimeType, file.contents);
    }
    for (const file of input.authoring.bundle.files) {
      assertManifestPath(file.path);
      const entry = input.authoring.bundle.manifest.find(({ path }) => path === file.path);
      if (!entry) throw new Error(`Bundle manifest is missing: ${file.path}`);
      await this.#upload(`${storagePrefix}/bundle/${file.path}`, entry.mimeType, file.contents);
    }

    const screenshotPath = `${storagePrefix}/validation/browser.png`;
    await this.#upload(screenshotPath, 'image/png', input.authoring.browserScreenshot);

    const response = await this.#fetch(
      `${this.#url}/rest/v1/rpc/accept_report_artifact_revision`,
      {
        method: 'POST',
        headers: this.#jsonHeaders(),
        body: JSON.stringify({
          p_artifact_id: artifactId,
          p_revision_id: revisionId,
          p_request_id: input.requestId,
          p_source_reference: input.sourceReference,
          p_title: input.title,
          p_storage_bucket: this.#bucket,
          p_storage_prefix: storagePrefix,
          p_source_manifest: manifestJson(input.authoring.source.manifest),
          p_bundle_manifest: manifestJson(input.authoring.bundle.manifest),
          p_screenshot_path: screenshotPath,
          p_template_alias: input.templateAlias,
        }),
      },
    );
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1_000);
      throw new Error(`Artifact acceptance failed (${response.status}): ${detail}`);
    }

    const payload = (await response.json()) as AcceptanceRow | AcceptanceRow[];
    const row = Array.isArray(payload) ? payload[0] : payload;
    if (!row) throw new Error('Artifact acceptance returned no descriptor');

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

  async #upload(path: string, mimeType: string, contents: Uint8Array): Promise<void> {
    const response = await this.#fetch(
      `${this.#url}/storage/v1/object/${encodeURIComponent(this.#bucket)}/${encodeObjectPath(path)}`,
      {
        method: 'POST',
        headers: {
          apikey: this.#serviceRoleKey,
          Authorization: `Bearer ${this.#serviceRoleKey}`,
          'Content-Type': storageUploadContentType(mimeType),
          'Cache-Control': '31536000',
          'x-upsert': 'false',
        },
        body: Buffer.from(contents),
      },
    );
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1_000);
      throw new Error(`Storage upload failed (${response.status}): ${detail}`);
    }
  }

  #jsonHeaders(): Record<string, string> {
    return {
      apikey: this.#serviceRoleKey,
      Authorization: `Bearer ${this.#serviceRoleKey}`,
      'Content-Type': 'application/json',
    };
  }
}
