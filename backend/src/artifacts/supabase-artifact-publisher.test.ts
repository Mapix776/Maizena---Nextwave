import assert from 'node:assert/strict';
import test from 'node:test';

import type { AuthoringResult } from './authoring-runner.js';
import { SupabaseArtifactPublisher } from './supabase-artifact-publisher.js';

const encoder = new TextEncoder();

function acceptedAuthoringResult(): AuthoringResult {
  const sourceFiles = [
    ['data/fixture.json', '{"operation":{"reference":"OP-2026-101"}}'],
    ['index.html', '<main data-report-root></main>'],
    ['src/main.js', 'document.body.dataset.reportReady="true"'],
    ['src/styles.css', 'body{color:navy}'],
  ] as const;
  const bundleFiles = [
    ['assets/app.js', 'document.body.dataset.ready="true"'],
    ['index.html', '<main data-report-root></main>'],
  ] as const;
  const manifest = (files: ReadonlyArray<readonly [string, string]>) =>
    files.map(([path, contents]) => ({
      path,
      mimeType: path.endsWith('.html')
        ? 'text/html; charset=utf-8'
        : path.endsWith('.json')
          ? 'application/json; charset=utf-8'
          : path.endsWith('.css')
            ? 'text/css; charset=utf-8'
            : 'text/javascript; charset=utf-8',
      bytes: encoder.encode(contents).byteLength,
      sha256: 'a'.repeat(64),
    }));

  return {
    verdict: 'accepted',
    source: {
      files: sourceFiles.map(([path, contents]) => ({ path, contents: encoder.encode(contents) })),
      manifest: manifest(sourceFiles),
    },
    bundle: {
      files: bundleFiles.map(([path, contents]) => ({ path, contents: encoder.encode(contents) })),
      manifest: manifest(bundleFiles),
    },
    manifest: manifest(bundleFiles),
    browserScreenshot: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
    cleanup: 'confirmed',
    evidence: [],
  };
}

test('uploads immutable source, bundle, and screenshot objects before accepting the revision', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const ids = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
  ];
  const publisher = new SupabaseArtifactPublisher({
    url: 'https://project.supabase.co',
    serviceRoleKey: 'service-secret',
    publicBaseUrl: 'https://api.example.test/',
    createId: () => ids.shift()!,
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('/rest/v1/rpc/')) {
        return Response.json([{
          artifact_id: '11111111-1111-4111-8111-111111111111',
          revision_id: '22222222-2222-4222-8222-222222222222',
          title: 'Custom logistics report',
          created_at: '2026-08-30T12:00:00.000Z',
        }]);
      }
      return new Response('{}', { status: 200 });
    },
  });

  const descriptor = await publisher.publish({
    requestId: 'browser-request-1',
    title: 'Custom logistics report',
    sourceReference: 'OP-2026-101',
    templateAlias: 'nauta-report-builder-v1',
    authoring: acceptedAuthoringResult(),
  });

  assert.equal(calls.length, 8);
  const uploadCalls = calls.slice(0, -1);
  const prefix = 'artifacts/11111111-1111-4111-8111-111111111111/revisions/22222222-2222-4222-8222-222222222222';
  assert.deepEqual(
    uploadCalls.map(({ url }) => decodeURIComponent(url).split('/report-artifacts/')[1]),
    [
      `${prefix}/source/data/fixture.json`,
      `${prefix}/source/index.html`,
      `${prefix}/source/src/main.js`,
      `${prefix}/source/src/styles.css`,
      `${prefix}/bundle/assets/app.js`,
      `${prefix}/bundle/index.html`,
      `${prefix}/validation/browser.png`,
    ],
  );
  for (const { init } of uploadCalls) {
    assert.equal(init?.method, 'POST');
    assert.equal(new Headers(init?.headers).get('x-upsert'), 'false');
  }
  assert.deepEqual(
    uploadCalls.map(({ init }) => new Headers(init?.headers).get('content-type')),
    [
      'application/json',
      'text/html',
      'text/javascript',
      'text/css',
      'text/javascript',
      'text/html',
      'image/png',
    ],
  );
  const acceptance = calls.at(-1)!;
  assert.match(acceptance.url, /\/rest\/v1\/rpc\/accept_report_artifact_revision$/);
  assert.equal(acceptance.init?.method, 'POST');
  const acceptanceBody = JSON.parse(String(acceptance.init?.body)) as {
    p_source_manifest: Array<{ path: string; mimeType: string }>;
    p_bundle_manifest: Array<{ path: string; mimeType: string }>;
  };
  assert.equal(
    acceptanceBody.p_source_manifest.find(({ path }) => path === 'data/fixture.json')?.mimeType,
    'application/json; charset=utf-8',
  );
  assert.equal(
    acceptanceBody.p_source_manifest.find(({ path }) => path === 'src/styles.css')?.mimeType,
    'text/css; charset=utf-8',
  );
  assert.equal(
    acceptanceBody.p_bundle_manifest.find(({ path }) => path === 'index.html')?.mimeType,
    'text/html; charset=utf-8',
  );
  assert.deepEqual(descriptor, {
    artifactId: '11111111-1111-4111-8111-111111111111',
    revisionId: '22222222-2222-4222-8222-222222222222',
    kind: 'custom-report',
    title: 'Custom logistics report',
    status: 'accepted',
    previewUrl: 'https://api.example.test/api/artifacts/11111111-1111-4111-8111-111111111111/revisions/22222222-2222-4222-8222-222222222222/content/',
    createdAt: '2026-08-30T12:00:00.000Z',
  });
});

test('does not call the acceptance RPC when an immutable upload fails', async () => {
  const calls: string[] = [];
  const ids = [
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
  ];
  const publisher = new SupabaseArtifactPublisher({
    url: 'https://project.supabase.co',
    serviceRoleKey: 'service-secret',
    createId: () => ids.shift()!,
    fetch: async (url) => {
      calls.push(String(url));
      return new Response('duplicate', { status: 409 });
    },
  });

  await assert.rejects(
    publisher.publish({
      requestId: 'browser-request-2',
      title: 'Custom logistics report',
      sourceReference: 'OP-2026-101',
      templateAlias: 'nauta-report-builder-v1',
      authoring: acceptedAuthoringResult(),
    }),
    /Storage upload failed \(409\)/,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls.some((url) => url.includes('/rpc/')), false);
});
