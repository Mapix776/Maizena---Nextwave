import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { assessRenderedPresentation } from './presentation-contract.mjs';

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

async function collectPresentationSnapshot(page, viewport) {
  const expectedContainerIds = fixture.containers.map(({ number }) => number);
  const expectedFormattedNumbers = [fixture.executiveSummary?.estimatedValueUsd]
    .filter((value) => typeof value === 'number' && Math.abs(value) >= 1_000);
  return page.evaluate(({ expectedContainerIds, expectedFormattedNumbers, viewport }) => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement || element instanceof SVGElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) > 0
        && rect.width > 0
        && rect.height > 0;
    };
    const visibleElements = [...document.querySelectorAll('body *')].filter(isVisible);
    const visibleText = document.body.innerText;
    const kpiGrid = document.querySelector('[data-kpi-grid]');
    const shapeSelector = 'svg rect, svg circle, svg line, svg path, svg polyline, svg polygon';
    const namedVisualSelector = [
      '[data-report-visual] *',
      '[class*="chart"]',
      '[class*="bar"]',
      '[class*="progress"]',
      '[class*="timeline"]',
      '[class*="route"]',
      '[class*="visual"]',
    ].join(', ');
    const kpiCandidates = [...document.querySelectorAll(
      '[class*="kpi"], [class*="metric"], [class*="stat"]',
    )].filter(isVisible);
    const backgroundColors = visibleElements
      .map((element) => getComputedStyle(element).backgroundColor)
      .filter((color) => color && color !== 'transparent' && !/rgba\([^)]*,\s*0\s*\)$/.test(color));

    return {
      viewport,
      horizontalOverflow:
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
          > window.innerWidth + 1,
      bodyFontFamily: getComputedStyle(document.body).fontFamily,
      bodyBackgroundColor: getComputedStyle(document.body).backgroundColor,
      visibleFontSizes: visibleElements.map((element) => getComputedStyle(element).fontSize),
      visibleBackgroundColors: backgroundColors,
      multiColumnGridCount: visibleElements.filter((element) => {
        const style = getComputedStyle(element);
        return style.display === 'grid'
          && style.gridTemplateColumns.split(/\s+/).filter(Boolean).length >= 2;
      }).length,
      kpiCount: kpiGrid
        ? [...kpiGrid.children].filter(isVisible).length
        : kpiCandidates.length,
      visualShapeCount: [...document.querySelectorAll(shapeSelector)].filter(isVisible).length,
      visualPrimitiveCount: [...document.querySelectorAll(namedVisualSelector)]
        .filter(isVisible).length,
      expectedContainerIds,
      visibleContainerIds: expectedContainerIds.filter((id) => visibleText.includes(id)),
      unformattedNumbers: expectedFormattedNumbers.filter((value) => {
        const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|\\D)${escaped}(\\D|$)`).test(visibleText);
      }),
      visibleText,
    };
  }, { expectedContainerIds, expectedFormattedNumbers, viewport });
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
  const desktopPresentation = assessRenderedPresentation(
    await collectPresentationSnapshot(page, 'desktop'),
  ).map((failure) => `desktop:${failure}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  const mobilePresentation = assessRenderedPresentation(
    await collectPresentationSnapshot(page, 'mobile'),
  ).map((failure) => `mobile:${failure}`);
  const presentationFailures = [...desktopPresentation, ...mobilePresentation];
  if (presentationFailures.length) {
    throw new Error(`Presentation browser contract failed: ${JSON.stringify(presentationFailures)}`);
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
  if (externalRequests.length) {
    throw new Error(`External browser requests: ${externalRequests.join(', ')}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  await page.screenshot({ path: `${root}/report-validation.png`, fullPage: true });
  console.log(JSON.stringify({
    gate: 'browser-validation',
    title,
    reportRoot,
    externalRequests: 0,
    pageErrors: 0,
    presentationChecks: 2,
  }));
} finally {
  await browser?.close();
  preview.kill('SIGTERM');
  await new Promise((resolve) => preview.once('exit', resolve));
}
