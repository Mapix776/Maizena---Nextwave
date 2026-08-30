import assert from 'node:assert/strict';
import test from 'node:test';

import { createE2BSandboxFactory } from './e2b-authoring-sandbox.js';

test('maps the deep runner contract to a secured, non-resumable E2B sandbox', async () => {
  const createCalls: unknown[][] = [];
  const commandCalls: unknown[][] = [];
  let killed = false;

  const factory = createE2BSandboxFactory({
    template: 'nauta-report-builder-v1',
    create: async (...args) => {
      createCalls.push(args);
      return {
        files: {
          list: async () => [
            { path: '/workspace/report/dist', type: 'dir' },
            { path: '/workspace/report/dist/index.html', type: 'file' },
          ],
          read: async () => new TextEncoder().encode('<main></main>'),
          write: async () => undefined,
        },
        commands: {
          run: async (...commandArgs: unknown[]) => {
            commandCalls.push(commandArgs);
            return { exitCode: 0, stdout: 'ok', stderr: '' };
          },
        },
        kill: async () => {
          killed = true;
          return true;
        },
      };
    },
  });

  const sandbox = await factory({
    jobId: 'opaque-job',
    allowInternetAccess: false,
  });

  await sandbox.writeFile('/workspace/report/src/main.js', new Uint8Array([1, 2]));
  assert.deepEqual(await sandbox.listFiles('/workspace/report/dist'), [
    '/workspace/report/dist/index.html',
  ]);
  await sandbox.run('build');
  await sandbox.kill();

  assert.deepEqual(createCalls, [
    [
      'nauta-report-builder-v1',
      {
        allowInternetAccess: false,
        envs: {},
        lifecycle: { autoResume: false, onTimeout: 'kill' },
        metadata: { jobId: 'opaque-job', purpose: 'nauta-report-authoring' },
        secure: true,
        timeoutMs: 180_000,
      },
    ],
  ]);
  assert.deepEqual(commandCalls, [
    [
      'npm run build',
      { cwd: '/workspace/report', timeoutMs: 90_000 },
    ],
  ]);
  assert.equal(killed, true);
});

test('rejects symlinks reported anywhere in the export tree', async () => {
  const factory = createE2BSandboxFactory({
    create: async () => ({
      files: {
        list: async () => [
          {
            path: '/workspace/report/dist/leak.js',
            type: 'symlink',
            symlinkTarget: '/etc/passwd',
          },
        ],
        read: async () => new Uint8Array(),
        write: async () => undefined,
      },
      commands: {
        run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
      },
      kill: async () => true,
    }),
  });

  const sandbox = await factory({
    jobId: 'opaque-job',
    allowInternetAccess: false,
  });

  await assert.rejects(
    sandbox.listFiles('/workspace/report/dist'),
    /Symlink is not exportable/,
  );
});
