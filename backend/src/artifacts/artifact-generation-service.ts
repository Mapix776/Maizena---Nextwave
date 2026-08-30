import { randomUUID } from 'node:crypto';

import fixture from './fixtures/e2b-tracer-operation.json' with { type: 'json' };
import {
  runAuthoringJob,
  type AuthoringSandbox,
  type RunAuthoringJobInput,
  type SandboxCreatePolicy,
} from './authoring-runner.js';
import type {
  AcceptedArtifactLookup,
  ArtifactGenerationService,
  GenerateReportInput,
  ReportArtifactDescriptor,
} from './artifact-contracts.js';
import { SupabaseAcceptedArtifactLookup } from './accepted-artifact-lookup.js';
import { createE2BSandboxFactory } from './e2b-authoring-sandbox.js';
import {
  authorCustomReport,
  type ReportAuthorOptions,
} from './report-author.js';
import {
  SupabaseArtifactPublisher,
  type ArtifactPublisher,
} from './supabase-artifact-publisher.js';

type RunJob = (input: RunAuthoringJobInput) => ReturnType<typeof runAuthoringJob>;
type ReportAuthor = (
  workspace: Parameters<typeof authorCustomReport>[0],
  options: ReportAuthorOptions,
) => ReturnType<typeof authorCustomReport>;

function sourceReferenceFrom(value: unknown): string {
  if (!value || typeof value !== 'object') return 'OP-2026-101';
  const operation = (value as { operation?: unknown }).operation;
  if (!operation || typeof operation !== 'object') return 'OP-2026-101';
  const reference = (operation as { reference?: unknown }).reference;
  return typeof reference === 'string' && reference.trim()
    ? reference.trim().slice(0, 200)
    : 'OP-2026-101';
}

export class E2BArtifactGenerationService implements ArtifactGenerationService {
  readonly #fixture: unknown;
  readonly #templateAlias: string;
  readonly #createId: () => string;
  readonly #createSandbox: (
    policy: SandboxCreatePolicy,
  ) => Promise<AuthoringSandbox>;
  readonly #author: ReportAuthor;
  readonly #runJob: RunJob;
  readonly #publisher: ArtifactPublisher;
  readonly #acceptedLookup: AcceptedArtifactLookup;

  constructor(options: {
    fixture?: unknown;
    templateAlias?: string;
    createId?: () => string;
    createSandbox?: (policy: SandboxCreatePolicy) => Promise<AuthoringSandbox>;
    author?: ReportAuthor;
    runJob?: RunJob;
    publisher?: ArtifactPublisher;
    acceptedLookup?: AcceptedArtifactLookup;
  } = {}) {
    this.#fixture = options.fixture ?? fixture;
    this.#templateAlias =
      options.templateAlias ??
      process.env.E2B_REPORT_TEMPLATE ??
      'nauta-report-builder-v1';
    this.#createId = options.createId ?? randomUUID;
    this.#createSandbox =
      options.createSandbox ??
      createE2BSandboxFactory({ template: this.#templateAlias });
    this.#author = options.author ?? authorCustomReport;
    this.#runJob = options.runJob ?? runAuthoringJob;
    this.#publisher = options.publisher ?? new SupabaseArtifactPublisher();
    this.#acceptedLookup =
      options.acceptedLookup ?? new SupabaseAcceptedArtifactLookup();
  }

  async generate(input: GenerateReportInput): Promise<ReportArtifactDescriptor> {
    const existing = await this.#acceptedLookup.findByRequestId(input.requestId);
    if (existing) return existing;

    const authoring = await this.#runJob({
      jobId: `report-${this.#createId()}`,
      fixture: this.#fixture,
      createSandbox: this.#createSandbox,
      author: async (workspace, context) => {
        await this.#author(workspace, {
          userPrompt: input.prompt,
          feedback: context.feedback,
        });
      },
    });

    return this.#publisher.publish({
      requestId: input.requestId,
      title: 'Custom logistics report',
      sourceReference:
        process.env.REPORT_DEMO_SOURCE_REFERENCE ??
        sourceReferenceFrom(this.#fixture),
      templateAlias: this.#templateAlias,
      authoring,
    });
  }
}
