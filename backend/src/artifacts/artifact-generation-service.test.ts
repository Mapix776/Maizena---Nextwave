import assert from 'node:assert/strict';
import test from 'node:test';

import type { AuthoringResult, RunAuthoringJobInput } from './authoring-runner.js';
import { E2BArtifactGenerationService } from './artifact-generation-service.js';

test('composes the existing authoring pipeline with the browser prompt and publisher', async () => {
  const authoring = {
    verdict: 'accepted',
    source: { files: [], manifest: [] },
    bundle: { files: [], manifest: [] },
    manifest: [],
    browserScreenshot: Uint8Array.from([1]),
    cleanup: 'confirmed',
    evidence: [],
  } satisfies AuthoringResult;
  let runnerInput: RunAuthoringJobInput | undefined;
  let authorOptions: unknown;
  let publishInput: unknown;
  const descriptor = {
    artifactId: '11111111-1111-4111-8111-111111111111',
    revisionId: '22222222-2222-4222-8222-222222222222',
    kind: 'custom-report' as const,
    title: 'Custom logistics report',
    status: 'accepted' as const,
    previewUrl: 'https://api.example.test/content',
    createdAt: '2026-08-30T12:00:00.000Z',
  };
  const service = new E2BArtifactGenerationService({
    fixture: { operation: { reference: 'OP-2026-101' } },
    templateAlias: 'template-v1',
    createId: () => '33333333-3333-4333-8333-333333333333',
    createSandbox: async () => {
      throw new Error('runner fake does not create a sandbox');
    },
    author: async (_workspace, options) => {
      authorOptions = options;
      return { summary: 'done', writtenPaths: [] };
    },
    runJob: async (input) => {
      runnerInput = input;
      await input.author({} as never, { attempt: 1 });
      return authoring;
    },
    publisher: {
      async publish(input) {
        publishInput = input;
        return descriptor;
      },
    },
    acceptedLookup: { findByRequestId: async () => null },
  });

  const result = await service.generate({
    requestId: 'browser-request-1',
    prompt: 'Focus on delayed containers.',
  });

  assert.equal(runnerInput?.jobId, 'report-33333333-3333-4333-8333-333333333333');
  assert.deepEqual(authorOptions, {
    userPrompt: 'Focus on delayed containers.',
    feedback: undefined,
  });
  assert.deepEqual(publishInput, {
    requestId: 'browser-request-1',
    title: 'Custom logistics report',
    sourceReference: 'OP-2026-101',
    templateAlias: 'template-v1',
    authoring,
  });
  assert.equal(result, descriptor);
});

test('returns a persisted accepted request before starting paid authoring', async () => {
  const existing = {
    artifactId: '55555555-5555-4555-8555-555555555555',
    revisionId: '66666666-6666-4666-8666-666666666666',
    kind: 'custom-report' as const,
    title: 'Existing report',
    status: 'accepted' as const,
    previewUrl: 'https://api.example.test/existing',
    createdAt: '2026-08-30T13:00:00.000Z',
  };
  let runnerCalls = 0;
  let publisherCalls = 0;
  const service = new E2BArtifactGenerationService({
    acceptedLookup: {
      async findByRequestId(requestId) {
        assert.equal(requestId, 'persisted-request');
        return existing;
      },
    },
    runJob: async () => {
      runnerCalls += 1;
      throw new Error('paid authoring must not start');
    },
    publisher: {
      async publish() {
        publisherCalls += 1;
        throw new Error('publisher must not run');
      },
    },
  });

  assert.equal(await service.generate({
    requestId: 'persisted-request',
    prompt: 'This prompt must not trigger E2B.',
  }), existing);
  assert.equal(runnerCalls, 0);
  assert.equal(publisherCalls, 0);
});
