import assert from 'node:assert/strict';
import test from 'node:test';

import type { AuthoringWorkspace } from './authoring-runner.js';
import {
  authorCustomReport,
  reportAuthorModelId,
} from './report-author.js';

test('report authoring prefers its design-capable model route and supports the legacy reasoning setting', () => {
  assert.equal(
    reportAuthorModelId({
      OPENAI_REPORT_MODEL: 'report-model',
      OPENAI_MODEL_REASONING: 'legacy-reasoning-model',
      OPENAI_MAIN_MODEL: 'main-model',
    }),
    'report-model',
  );
  assert.equal(
    reportAuthorModelId({
      OPENAI_MODEL_REASONING: 'legacy-reasoning-model',
      OPENAI_MAIN_MODEL: 'main-model',
    }),
    'legacy-reasoning-model',
  );
  assert.equal(
    reportAuthorModelId({ OPENAI_MAIN_MODEL: 'main-model' }),
    'main-model',
  );
});

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
    userPrompt: 'Highlight customs risk and delayed containers.',
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
  assert.match(prompt, /Highlight customs risk and delayed containers\./);
  assert.match(prompt, /no external/i);
  assert.match(prompt, /design tokens/i);
  assert.match(prompt, /Intl\.NumberFormat/);
  assert.match(prompt, /Intl\.DateTimeFormat/);
  assert.match(prompt, /human-readable labels/i);
  assert.match(prompt, /data-kpi-grid/);
  assert.match(prompt, /data-report-visual/);
  assert.match(prompt, /inline SVG/i);
  assert.match(prompt, /composition, palette, and visualization/i);
  assert.equal(result.summary, 'Custom report authored.');
  assert.deepEqual(result.writtenPaths, [
    'index.html',
    'src/main.js',
    'src/styles.css',
  ]);
});

test('rejects an unbounded report request before invoking the author', async () => {
  let invoked = false;
  const workspace: AuthoringWorkspace = {
    list: async () => [],
    read: async () => '',
    write: async () => undefined,
  };

  await assert.rejects(
    authorCustomReport(workspace, {
      userPrompt: 'x'.repeat(1_201),
      createAgent: () => ({
        async generate() {
          invoked = true;
          return { text: '' };
        },
      }),
    }),
    /Report request must be between 1 and 1200 characters/,
  );
  assert.equal(invoked, false);
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
