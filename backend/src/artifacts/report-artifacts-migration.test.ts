import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationDirectory = fileURLToPath(
  new URL('../../supabase/migrations', import.meta.url),
);

function docker(args: string[], input?: string) {
  return spawnSync('docker', args, { encoding: 'utf8', input });
}

const sourceManifest = JSON.stringify([
  { path: 'data/fixture.json', mimeType: 'application/json; charset=utf-8', bytes: 1, sha256: 'a'.repeat(64) },
  { path: 'index.html', mimeType: 'text/html; charset=utf-8', bytes: 1, sha256: 'b'.repeat(64) },
  { path: 'src/main.js', mimeType: 'text/javascript; charset=utf-8', bytes: 1, sha256: 'c'.repeat(64) },
  { path: 'src/styles.css', mimeType: 'text/css; charset=utf-8', bytes: 1, sha256: 'd'.repeat(64) },
]);
const bundleManifest = JSON.stringify([
  { path: 'index.html', mimeType: 'text/html; charset=utf-8', bytes: 1, sha256: 'e'.repeat(64) },
]);

function acceptanceSql(sourceReference = 'OP-2026-101') {
  const artifactId = '11111111-1111-4111-8111-111111111111';
  const revisionId = '22222222-2222-4222-8222-222222222222';
  const prefix = `artifacts/${artifactId}/revisions/${revisionId}`;
  return `select artifact_id, revision_id from public.accept_report_artifact_revision(
    '${artifactId}'::uuid,
    '${revisionId}'::uuid,
    'migration-behavior-request',
    '${sourceReference}',
    'Custom logistics report',
    'report-artifacts',
    '${prefix}',
    '${sourceManifest}'::jsonb,
    '${bundleManifest}'::jsonb,
    '${prefix}/validation/browser.png',
    'nauta-report-builder-v1'
  );`;
}

test('migration defines private immutable report authority with service-role-only acceptance', async () => {
  const sql = await readFile(
    new URL('../../supabase/migrations/006_report_artifacts.sql', import.meta.url),
    'utf8',
  );
  assert.match(sql, /insert into storage\.buckets/i);
  assert.match(sql, /'report-artifacts'[\s\S]*false[\s\S]*file_size_limit/i);
  assert.match(sql, /create table public\.report_artifacts/i);
  assert.match(sql, /create table public\.report_artifact_revisions/i);
  assert.match(sql, /enable row level security/gi);
  assert.match(sql, /revoke all privileges[\s\S]*anon, authenticated/i);
  assert.match(sql, /grant select[\s\S]*to service_role/i);
  assert.match(sql, /accept_report_artifact_revision/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /grant execute[\s\S]*to service_role/i);
  assert.match(sql, /request_id[\s\S]*unique/i);
  assert.match(sql, /storage_prefix[\s\S]*unique/i);
  assert.match(sql, /accepted_revision_id/i);
  assert.match(sql, /operation_id UUID NOT NULL/i);
  assert.match(sql, /references public\.operations\(id\)/i);
  assert.match(sql, /report_artifacts_operation_idx/i);
  const artifactTable = sql.match(
    /create table public\.report_artifacts \([\s\S]*?\n\);/i,
  )?.[0] ?? '';
  assert.doesNotMatch(artifactTable, /source_reference/i);
  assert.doesNotMatch(sql, /insert\s+into\s+storage\.objects/i);
  assert.doesNotMatch(sql, /update\s+storage\.objects/i);
});

test('migration resolves the operation reference transactionally and enforces the indexed FK', async (context) => {
  if (docker(['image', 'inspect', 'postgres:15-alpine']).status !== 0) {
    context.skip('postgres:15-alpine is unavailable');
    return;
  }

  const container = `nauta-report-migration-${randomUUID()}`;
  const started = docker([
    'run', '--rm', '-d', '--name', container,
    '-e', 'POSTGRES_PASSWORD=check',
    '-v', `${migrationDirectory}:/migrations:ro`,
    'postgres:15-alpine',
  ]);
  assert.equal(started.status, 0, started.stderr);
  context.after(() => {
    docker(['stop', container]);
  });

  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const logs = docker(['logs', container]);
    const initialized = `${logs.stdout}\n${logs.stderr}`.includes(
      'PostgreSQL init process complete; ready for start up.',
    );
    if (initialized && docker([
      'exec', container, 'psql', '-X', '-At', '-U', 'postgres', '-c', 'select 1',
    ]).status === 0) {
      ready = true;
      break;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  assert.equal(ready, true, 'Disposable Postgres did not become ready');

  const psql = (sql: string) => docker([
    'exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-U', 'postgres',
  ], sql);
  const bootstrap = psql(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table public.operations (
      id uuid primary key,
      reference_code text unique not null
    );
    insert into public.operations (id, reference_code)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'OP-2026-101');
  `);
  assert.equal(bootstrap.status, 0, bootstrap.stderr);

  const migrated = docker([
    'exec', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres',
    '-f', '/migrations/006_report_artifacts.sql',
  ]);
  assert.equal(migrated.status, 0, migrated.stderr);

  const accepted = psql(acceptanceSql());
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(accepted.stdout, /11111111-1111-4111-8111-111111111111\|22222222-2222-4222-8222-222222222222/);

  const authority = psql(`
    select operation_id::text from public.report_artifacts
    where id = '11111111-1111-4111-8111-111111111111';
    select count(*) from pg_indexes
    where schemaname = 'public'
      and tablename = 'report_artifacts'
      and indexdef like '%operation_id%';
  `);
  assert.equal(authority.status, 0, authority.stderr);
  assert.equal(authority.stdout.trim(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\n1');

  const persistedLookup = psql(`
    set role service_role;
    select artifact_id::text, revision_id::text
    from public.find_accepted_report_artifact_by_request_id(
      'migration-behavior-request'
    );
    reset role;
  `);
  assert.equal(persistedLookup.status, 0, persistedLookup.stderr);
  assert.match(
    persistedLookup.stdout,
    /11111111-1111-4111-8111-111111111111\|22222222-2222-4222-8222-222222222222/,
  );

  const missingOperation = psql(
    acceptanceSql('OP-DOES-NOT-EXIST')
      .replaceAll('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333')
      .replaceAll('22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444')
      .replace('migration-behavior-request', 'missing-operation-request'),
  );
  assert.notEqual(missingOperation.status, 0);
  assert.match(missingOperation.stderr, /operation reference does not exist/i);

  const deleteAuthority = psql(
    "delete from public.operations where reference_code = 'OP-2026-101';",
  );
  assert.notEqual(deleteAuthority.status, 0);
  assert.match(deleteAuthority.stderr, /foreign key constraint/i);
});
