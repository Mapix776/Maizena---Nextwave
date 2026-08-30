import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { verifyBundleIndependently } from './independent-preview.js';

test('materializes and serves the verified bundle without a sandbox URL', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'nauta-report-preview-'));
  const encoder = new TextEncoder();

  const evidence = await verifyBundleIndependently(
    {
      files: [
        {
          path: 'index.html',
          contents: encoder.encode('<main data-report-root>OP-2026-101</main><script src="/assets/app.js"></script>'),
        },
        {
          path: 'assets/app.js',
          contents: encoder.encode('document.body.dataset.reportReady="true"'),
        },
      ],
      manifest: [],
    },
    outputDirectory,
  );

  assert.deepEqual(evidence.checkedPaths, ['assets/app.js', 'index.html']);
  assert.equal(evidence.indexContainsReportRoot, true);
  assert.match(evidence.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
});
