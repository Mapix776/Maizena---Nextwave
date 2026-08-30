import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

import fixture from './fixtures/e2b-tracer-operation.json' with { type: 'json' };
import { runAuthoringJob } from './authoring-runner.js';
import { createE2BSandboxFactory } from './e2b-authoring-sandbox.js';
import { verifyBundleIndependently } from './independent-preview.js';
import { authorCustomReport } from './report-author.js';

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

for (const key of ['E2B_API_KEY', 'OPENAI_API_KEY'] as const) {
  if (!process.env[key]) throw new Error(`${key} is required for the live E2B tracer`);
}

const jobId = `e2b-tracer-${randomUUID()}`;
const outputRoot = resolve('.tracer-output/e2b');
const revisionDirectory = resolve(outputRoot, 'revisions', jobId);
const outputDirectory = resolve(revisionDirectory, 'bundle');
const browserEvidencePath = resolve(revisionDirectory, 'browser-validation.png');

const startedAt = performance.now();
let authorSummary = '';
const result = await runAuthoringJob({
  jobId,
  fixture,
  createSandbox: createE2BSandboxFactory(),
  author: async (workspace, context) => {
    const authored = await authorCustomReport(workspace, {
      feedback: context.feedback,
    });
    authorSummary = authored.summary;
  },
});

// runAuthoringJob resolves only after its finally block confirms E2B cleanup.
const independentPreview = await verifyBundleIndependently(
  result.bundle,
  outputDirectory,
);
if (!independentPreview.indexContainsReportRoot) {
  throw new Error('Exported report lost its report root after sandbox cleanup');
}
await writeFile(browserEvidencePath, result.browserScreenshot);
const latestPointer = {
  jobId,
  revisionDirectory,
  outputDirectory,
  browserEvidencePath,
  manifest: result.manifest,
};
await mkdir(outputRoot, { recursive: true });
const pendingPointerPath = resolve(outputRoot, `.latest-${jobId}.json`);
await writeFile(pendingPointerPath, `${JSON.stringify(latestPointer, null, 2)}\n`);
await rename(pendingPointerPath, resolve(outputRoot, 'latest.json'));

console.log(JSON.stringify({
  tracer: 'e2b-custom-report',
  verdict: result.verdict,
  cleanup: result.cleanup,
  authorSummary,
  durationMs: Math.round(performance.now() - startedAt),
  gates: result.evidence.map(({ gate, stdout }) => ({ gate, stdout })),
  manifest: result.manifest,
  independentPreview,
  outputDirectory,
  browserEvidencePath,
}, null, 2));
