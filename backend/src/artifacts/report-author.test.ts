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
    userPrompt: 'Use a monochrome editorial newspaper style while highlighting customs risk.',
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
  assert.match(prompt, /Use a monochrome editorial newspaper style while highlighting customs risk\./);
  assert.match(prompt, /Ari visual language is the default/i);
  assert.match(prompt, /#fbf9ff/i);
  assert.match(prompt, /#211d38/i);
  assert.match(prompt, /#ba46d6/i);
  assert.match(prompt, /explicit user-requested visual style.*overrides.*Ari/i);
  assert.match(prompt, /do not blend.*Ari palette/i);
  assert.match(prompt, /palette within the active art direction/i);
  assert.match(prompt, /no external/i);
  assert.match(prompt, /design tokens/i);
  assert.match(prompt, /Intl\.NumberFormat/);
  assert.match(prompt, /Intl\.DateTimeFormat/);
  assert.match(prompt, /human-readable labels/i);
  assert.match(prompt, /data-kpi-grid/);
  assert.match(prompt, /data-report-visual/);
  assert.match(prompt, /inline SVG/i);
  assert.match(prompt, /composition and visualization type/i);
  assert.match(prompt, /reports are static/i);
  assert.match(prompt, /do not create buttons, filters, toggles, tabs/i);
  assert.match(prompt, /never emit HTML event-handler attributes/i);
  assert.match(prompt, /at least four distinct computed font sizes/i);
  assert.match(prompt, /at least three distinct opaque background colors/i);
  assert.match(prompt, /overflow-wrap: anywhere/i);
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
