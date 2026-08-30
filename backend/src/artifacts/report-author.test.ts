import assert from 'node:assert/strict';
import test from 'node:test';

import type { AuthoringWorkspace } from './authoring-runner.js';
import { authorCustomReport } from './report-author.js';

test('gives the AI only logical report tools and requires all three source files', async () => {
  const files = new Map<string, string>([
    ['data/fixture.json', '{"operation":"OP-2026-101"}'],
  ]);
  const workspace: AuthoringWorkspace = {
    list: async () => [...files.keys()].sort(),
    read: async (path) => {
      const value = files.get(path);
      if (value === undefined) throw new Error(`missing ${path}`);
      return value;
    },
    write: async (path, contents) => {
      files.set(path, contents);
    },
  };
  let prompt = '';
  let exposedToolNames: string[] = [];

  const result = await authorCustomReport(workspace, {
    createAgent: (tools) => ({
      async generate(messages) {
        prompt = String(messages[0]?.content ?? '');
        exposedToolNames = Object.keys(tools).sort();
        assert.ok(tools.reportWrite.execute);
        await tools.reportWrite.execute(
          { path: 'index.html', contents: '<main data-report-root></main>' },
          {} as never,
        );
        await tools.reportWrite.execute(
          { path: 'src/main.js', contents: 'document.body.dataset.reportReady="true"' },
          {} as never,
        );
        await tools.reportWrite.execute(
          { path: 'src/styles.css', contents: 'body { color: navy; }' },
          {} as never,
        );
        return { text: 'Custom report authored.' };
      },
    }),
  });

  assert.deepEqual(exposedToolNames, ['reportList', 'reportRead', 'reportWrite']);
  assert.match(prompt, /sanitized logistics fixture/i);
  assert.match(prompt, /no external/i);
  assert.equal(result.summary, 'Custom report authored.');
  assert.deepEqual(result.writtenPaths, [
    'index.html',
    'src/main.js',
    'src/styles.css',
  ]);
});

test('fails before build when the AI omits a required source file', async () => {
  const workspace: AuthoringWorkspace = {
    list: async () => ['data/fixture.json'],
    read: async (path) => {
      if (path === 'data/fixture.json') return '{}';
      throw new Error(`missing ${path}`);
    },
    write: async () => undefined,
  };

  await assert.rejects(
    authorCustomReport(workspace, {
      createAgent: () => ({
        async generate() {
          return { text: 'Done.' };
        },
      }),
    }),
    /AI author did not create/,
  );
});
