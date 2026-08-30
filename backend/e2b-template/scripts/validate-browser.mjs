import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const root = '/workspace/report';
const require = createRequire(`${root}/package.json`);
const { chromium } = require('playwright');
const fixture = JSON.parse(await readFile(`${root}/data/fixture.json`, 'utf8'));
const preview = spawn(
  `${root}/node_modules/.bin/vite`,
  ['preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
);

let previewLogs = '';
preview.stdout.on('data', (chunk) => { previewLogs += chunk.toString(); });
preview.stderr.on('data', (chunk) => { previewLogs += chunk.toString(); });

async function waitUntilReady() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:4173/');
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Vite preview did not become ready: ${previewLogs.slice(-2_000)}`);
}

let browser;
try {
  await waitUntilReady();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    const hostname = new URL(request.url()).hostname;
    if (hostname !== '127.0.0.1') externalRequests.push(request.url());
  });

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForSelector('body[data-report-ready="true"]', { timeout: 10_000 });
  const title = await page.title();
  const reportRoot = await page.locator('[data-report-root]').count();
  const visibleText = await page.locator('body').innerText();
  if (!title.trim()) throw new Error('Rendered report title is empty');
  if (reportRoot !== 1) throw new Error(`Expected one report root, got ${reportRoot}`);
  if (!visibleText.includes(fixture.operation.reference)) {
    throw new Error(`Rendered report omitted ${fixture.operation.reference}`);
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
  if (externalRequests.length) {
    throw new Error(`External browser requests: ${externalRequests.join(', ')}`);
  }
  await page.screenshot({ path: `${root}/report-validation.png`, fullPage: true });
  console.log(JSON.stringify({
    gate: 'browser-validation',
    title,
    reportRoot,
    externalRequests: 0,
    pageErrors: 0,
  }));
} finally {
  await browser?.close();
  preview.kill('SIGTERM');
  await new Promise((resolve) => preview.once('exit', resolve));
}
