import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  ArtifactContentGateway,
  type ArtifactContentRepository,
} from './artifact-content-gateway.js';

const artifactId = '11111111-1111-4111-8111-111111111111';
const revisionId = '22222222-2222-4222-8222-222222222222';
const indexBytes = new TextEncoder().encode('<main>Nauta</main>');
const scriptBytes = new TextEncoder().encode('console.log("ok")');
const sha256 = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

class FakeRepository implements ArtifactContentRepository {
  downloads: string[] = [];
  accepted = {
    storageBucket: 'report-artifacts',
    storagePrefix: `artifacts/${artifactId}/revisions/${revisionId}`,
    bundleManifest: [
      {
        path: 'assets/app.js',
        mimeType: 'text/javascript; charset=utf-8',
        bytes: 17,
        sha256: sha256(scriptBytes),
      },
      {
        path: 'index.html',
        mimeType: 'text/html; charset=utf-8',
        bytes: 18,
        sha256: sha256(indexBytes),
      },
    ],
  };

  async findAcceptedRevision(requestArtifactId: string, requestRevisionId: string) {
    if (requestArtifactId !== artifactId || requestRevisionId !== revisionId) return null;
    return this.accepted;
  }

  async download(bucket: string, path: string) {
    this.downloads.push(`${bucket}/${path}`);
    return path.endsWith('index.html')
      ? indexBytes
      : scriptBytes;
  }
}

test('serves exact accepted manifest bytes and MIME with all isolation headers', async () => {
  const repository = new FakeRepository();
  const gateway = new ArtifactContentGateway(repository, {
    originPolicy: {
      frameAncestors: ['http://localhost:3000', 'https://maizena-nextwave.vercel.app'],
    },
  });

  const result = await gateway.get({ artifactId, revisionId, path: '' });

  assert.equal(result.status, 200);
  if (result.status !== 200) return;
  assert.equal(new TextDecoder().decode(result.bytes), '<main>Nauta</main>');
  assert.equal(result.headers['Content-Type'], 'text/html; charset=utf-8');
  assert.equal(result.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(result.headers['Cache-Control'], 'public, max-age=31536000, immutable');
  assert.equal(result.headers['Access-Control-Allow-Origin'], '*');
  assert.equal(result.headers['Cross-Origin-Resource-Policy'], 'cross-origin');
  assert.equal(
    result.headers['Content-Security-Policy'],
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors http://localhost:3000 https://maizena-nextwave.vercel.app",
  );
  assert.deepEqual(repository.downloads, [
    `report-artifacts/artifacts/${artifactId}/revisions/${revisionId}/bundle/index.html`,
  ]);
});

test('returns 404 when downloaded bytes have the accepted length but the wrong SHA-256', async () => {
  const repository = new FakeRepository();
  repository.download = async () => new TextEncoder().encode('<main>Wrong</main>');
  const gateway = new ArtifactContentGateway(repository);

  assert.deepEqual(await gateway.get({ artifactId, revisionId, path: 'index.html' }), {
    status: 404,
  });
});

test('returns 404 without downloading for wrong heads, extra paths, traversal, and malformed IDs', async () => {
  const repository = new FakeRepository();
  const gateway = new ArtifactContentGateway(repository);
  const requests = [
    { artifactId, revisionId: '33333333-3333-4333-8333-333333333333', path: 'index.html' },
    { artifactId, revisionId, path: 'not-in-manifest.js' },
    { artifactId, revisionId, path: '../source/index.html' },
    { artifactId: 'not-a-uuid', revisionId, path: 'index.html' },
  ];

  for (const request of requests) {
    assert.deepEqual(await gateway.get(request), { status: 404 });
  }
  assert.deepEqual(repository.downloads, []);
});
