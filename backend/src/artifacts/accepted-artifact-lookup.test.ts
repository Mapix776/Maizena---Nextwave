import assert from 'node:assert/strict';
import test from 'node:test';

import { SupabaseAcceptedArtifactLookup } from './accepted-artifact-lookup.js';

test('looks up an accepted request through the service-only RPC before authoring', async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const lookup = new SupabaseAcceptedArtifactLookup({
    url: 'https://project.supabase.co/',
    serviceRoleKey: 'service-secret',
    publicBaseUrl: 'https://api.example.test/',
    fetch: async (url, init) => {
      request = { url: String(url), init };
      return Response.json([{
        artifact_id: '11111111-1111-4111-8111-111111111111',
        revision_id: '22222222-2222-4222-8222-222222222222',
        title: 'Persisted report',
        created_at: '2026-08-30T12:00:00.000Z',
      }]);
    },
  });

  assert.deepEqual(await lookup.findByRequestId('persisted-request'), {
    artifactId: '11111111-1111-4111-8111-111111111111',
    revisionId: '22222222-2222-4222-8222-222222222222',
    kind: 'custom-report',
    title: 'Persisted report',
    status: 'accepted',
    previewUrl: 'https://api.example.test/api/artifacts/11111111-1111-4111-8111-111111111111/revisions/22222222-2222-4222-8222-222222222222/content/',
    createdAt: '2026-08-30T12:00:00.000Z',
  });
  assert.equal(
    request?.url,
    'https://project.supabase.co/rest/v1/rpc/find_accepted_report_artifact_by_request_id',
  );
  assert.deepEqual(JSON.parse(String(request?.init?.body)), {
    p_request_id: 'persisted-request',
  });
  assert.equal(new Headers(request?.init?.headers).get('authorization'), 'Bearer service-secret');
});

test('returns null when no persisted accepted head owns the request ID', async () => {
  const lookup = new SupabaseAcceptedArtifactLookup({
    url: 'https://project.supabase.co',
    serviceRoleKey: 'service-secret',
    fetch: async () => Response.json([]),
  });

  assert.equal(await lookup.findByRequestId('new-request'), null);
});

