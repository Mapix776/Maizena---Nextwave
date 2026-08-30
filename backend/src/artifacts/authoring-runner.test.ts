import assert from 'node:assert/strict';
import test from 'node:test';

import {
  runAuthoringJob,
  type AuthoringSandbox,
  type SandboxCreatePolicy,
} from './authoring-runner.js';

class FakeSandbox implements AuthoringSandbox {
  readonly files = new Map<string, Uint8Array>();
  readonly commands: string[] = [];
  killed = false;

  async listFiles(root: string) {
    return [...this.files.keys()].filter((path) => path.startsWith(`${root}/`));
  }

  async readFile(path: string) {
    const contents = this.files.get(path);
    if (!contents) throw new Error(`Missing fake file: ${path}`);
    return contents;
  }

  async writeFile(path: string, contents: Uint8Array) {
    this.files.set(path, contents);
  }

  async run(command: 'build' | 'validate-source' | 'validate-browser' | 'assert-no-network') {
    this.commands.push(command);
    if (command === 'build') {
      this.files.set('/workspace/report/dist/index.html', new TextEncoder().encode('<h1>Nauta</h1>'));
      this.files.set('/workspace/report/dist/assets/app.js', new TextEncoder().encode('document.body.dataset.ready="true";'));
    }
    if (command === 'validate-browser') {
      this.files.set(
        '/workspace/report/report-validation.png',
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]),
      );
    }
    return { exitCode: 0, stdout: `${command}: ok`, stderr: '' };
  }

  async kill() {
    this.killed = true;
  }
}

test('runs a no-network authoring job, exports a verified bundle, and kills the sandbox', async () => {
  const fake = new FakeSandbox();
  let createPolicy: SandboxCreatePolicy | undefined;

  const result = await runAuthoringJob({
    jobId: 'job-1',
    fixture: { operation: 'OP-2026-101', delayedContainers: 2 },
    createSandbox: async (policy) => {
      createPolicy = policy;
      return fake;
    },
    author: async (workspace) => {
      await workspace.write('index.html', '<main id="app"></main>');
      await workspace.write('src/main.js', 'console.log("custom report")');
      await workspace.write('src/styles.css', 'body { color: #17324d; }');
    },
  });

  assert.deepEqual(createPolicy, {
    jobId: 'job-1',
    allowInternetAccess: false,
  });
  assert.deepEqual(fake.commands, [
    'validate-source',
    'build',
    'validate-browser',
    'assert-no-network',
  ]);
  assert.equal(fake.killed, true);
  assert.equal(result.verdict, 'accepted');
  assert.equal(result.cleanup, 'confirmed');
  assert.deepEqual(result.manifest?.map(({ path }) => path), [
    'assets/app.js',
    'index.html',
  ]);
  assert.match(result.manifest?.[0]?.sha256 ?? '', /^[a-f0-9]{64}$/);
  assert.deepEqual(
    [...result.browserScreenshot],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1],
  );
  assert.equal('sandboxId' in result, false);
});

test('kills the sandbox and exports nothing when a fixed gate fails', async () => {
  const fake = new FakeSandbox();
  fake.run = async (command) => {
    fake.commands.push(command);
    return command === 'build'
      ? { exitCode: 1, stdout: '', stderr: 'build failed' }
      : { exitCode: 0, stdout: 'ok', stderr: '' };
  };

  await assert.rejects(
    runAuthoringJob({
      jobId: 'job-2',
      fixture: {},
      createSandbox: async () => fake,
      author: async (workspace) => {
        await workspace.write('index.html', '<main></main>');
        await workspace.write('src/main.js', '');
        await workspace.write('src/styles.css', '');
      },
    }),
    /build failed/,
  );

  assert.equal(fake.killed, true);
  assert.equal(fake.files.has('/workspace/report/dist/index.html'), false);
});

test('feeds bounded gate diagnostics back to the author and repairs in the same sandbox', async () => {
  const fake = new FakeSandbox();
  let buildAttempts = 0;
  const authorContexts: Array<{ attempt: number; feedback?: string }> = [];
  fake.run = async (command) => {
    fake.commands.push(command);
    if (command === 'build') {
      buildAttempts += 1;
      if (buildAttempts === 1) {
        return { exitCode: 1, stdout: '', stderr: 'invalid CSS at line 22' };
      }
      fake.files.set('/workspace/report/dist/index.html', new TextEncoder().encode('<main data-report-root></main>'));
    }
    if (command === 'validate-browser') {
      fake.files.set(
        '/workspace/report/report-validation.png',
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]),
      );
    }
    return { exitCode: 0, stdout: 'ok', stderr: '' };
  };

  const result = await runAuthoringJob({
    jobId: 'job-repair',
    fixture: {},
    createSandbox: async () => fake,
    author: async (workspace, context) => {
      authorContexts.push(context);
      await workspace.write('index.html', '<main data-report-root></main>');
      await workspace.write('src/main.js', 'document.body.dataset.reportReady="true"');
      await workspace.write(
        'src/styles.css',
        context.feedback ? 'body { color: navy; }' : 'body { color: navy; }.',
      );
    },
  });

  assert.equal(result.verdict, 'accepted');
  assert.equal(fake.killed, true);
  assert.deepEqual(authorContexts.map(({ attempt }) => attempt), [1, 2]);
  assert.match(authorContexts[1]?.feedback ?? '', /invalid CSS at line 22/);
  assert.deepEqual(fake.commands, [
    'validate-source',
    'build',
    'validate-source',
    'build',
    'validate-browser',
    'assert-no-network',
  ]);
});

test('rejects paths outside the three-file authoring surface before writing', async () => {
  const fake = new FakeSandbox();

  await assert.rejects(
    runAuthoringJob({
      jobId: 'job-3',
      fixture: {},
      createSandbox: async () => fake,
      author: async (workspace) => {
        await workspace.write('../escape.js', 'nope');
      },
    }),
    /Path is not editable/,
  );

  assert.equal(fake.killed, true);
  assert.equal(fake.files.has('/workspace/escape.js'), false);
});
