import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessRenderedPresentation,
  assessSourcePresentation,
  containsForbiddenExternalUrl,
  marksReportReady,
} from './presentation-contract.mjs';

const requiredRegions = {
  hero: true,
  kpis: true,
  risks: true,
  containers: true,
  timeline: true,
  decision: true,
  visual: true,
};

test('plain fallback source fails the visual authoring contract with named diagnostics', () => {
  const failures = assessSourcePresentation({
    html: '<main data-report-root></main>',
    main: 'document.body.dataset.reportReady = "true";',
    styles: 'body { color: black; }',
  });

  assert.deepEqual(failures, [
    'missing-design-tokens',
    'missing-explicit-typography',
    'missing-responsive-layout',
    'missing-number-formatter',
    'missing-date-formatter',
  ]);
});

test('custom responsive source passes without prescribing palette or section order', () => {
  const failures = assessSourcePresentation({
    html: '<main data-report-root></main>',
    main: `
      const money = new Intl.NumberFormat('es-MX');
      const date = new Intl.DateTimeFormat('es-MX');
      root.innerHTML = \`
        <section data-report-hero></section>
        <section data-risk-board></section>
        <section data-kpi-grid></section>
        <section data-route-timeline></section>
        <section data-container-matrix></section>
        <section data-decision-panel></section>
        <figure data-report-visual><svg><rect/><rect/><rect/></svg></figure>
      \`;
    `,
    styles: `
      :root {
        --ink: #10242f; --muted: #61717b; --canvas: #edf4f1;
        --surface: #ffffff; --accent: #0b7a75; --ok: #17875b;
        --warning: #b96a10; --critical: #bd3446; --space: 1rem;
        --radius: 1rem;
      }
      body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      @media (max-width: 700px) { main { display: block; } }
    `,
  });

  assert.deepEqual(failures, []);
});

test('an explicit-locale number formatter is accepted as an Intl-equivalent form', () => {
  const failures = assessSourcePresentation({
    html: '',
    main: `
      const amount = (486000).toLocaleString('es-MX');
      const date = new Intl.DateTimeFormat('es-MX');
    `,
    styles: '',
  });

  assert.equal(failures.includes('missing-number-formatter'), false);
});

test('rendered fallback fails desktop and mobile presentation checks', () => {
  const failures = assessRenderedPresentation({
    viewport: 'desktop',
    horizontalOverflow: true,
    bodyFontFamily: 'Times New Roman',
    bodyBackgroundColor: 'rgba(0, 0, 0, 0)',
    visibleFontSizes: ['16px', '32px'],
    visibleBackgroundColors: ['rgb(255, 255, 255)'],
    multiColumnGridCount: 0,
    kpiCount: 0,
    regions: { ...requiredRegions, visual: false },
    visualShapeCount: 0,
    visualPrimitiveCount: 0,
    expectedContainerIds: ['MSDU7000810', 'MSDU7000820'],
    visibleContainerIds: [],
    unformattedNumbers: [486000],
    visibleText: 'CUSTOMS_HOLD 486000',
  });

  assert.ok(failures.includes('horizontal-overflow'));
  assert.ok(failures.includes('default-typography'));
  assert.ok(failures.includes('default-background'));
  assert.ok(failures.includes('weak-type-hierarchy'));
  assert.ok(failures.includes('weak-color-system'));
  assert.ok(failures.includes('missing-desktop-grid'));
  assert.ok(failures.includes('insufficient-kpis'));
  assert.ok(failures.includes('missing-data-visualization'));
  assert.ok(failures.includes('missing-container:MSDU7000810'));
  assert.ok(failures.includes('raw-enum-label'));
  assert.ok(failures.includes('unformatted-number:486000'));
});

test('a polished custom presentation passes computed checks', () => {
  const failures = assessRenderedPresentation({
    viewport: 'desktop',
    horizontalOverflow: false,
    bodyFontFamily: 'Inter, ui-sans-serif, system-ui',
    bodyBackgroundColor: 'rgb(237, 244, 241)',
    visibleFontSizes: ['12px', '14px', '20px', '30px'],
    visibleBackgroundColors: [
      'rgb(237, 244, 241)',
      'rgb(255, 255, 255)',
      'rgb(11, 122, 117)',
      'rgb(189, 52, 70)',
    ],
    multiColumnGridCount: 2,
    kpiCount: 6,
    regions: requiredRegions,
    visualShapeCount: 6,
    visualPrimitiveCount: 0,
    expectedContainerIds: ['MSDU7000810', 'MSDU7000820'],
    visibleContainerIds: ['MSDU7000810', 'MSDU7000820'],
    unformattedNumbers: [],
    visibleText: 'Customs hold Customs review',
  });

  assert.deepEqual(failures, []);
});

test('readiness accepts equivalent DOM forms while rejecting a missing signal', () => {
  assert.equal(marksReportReady('document.body.dataset.reportReady = "true";'), true);
  assert.equal(marksReportReady('document.body.dataset.reportReady = true;'), true);
  assert.equal(
    marksReportReady("document.body.setAttribute('data-report-ready', 'true');"),
    true,
  );
  assert.equal(marksReportReady('renderReport();'), false);
});

test('the inert SVG namespaces are allowed while real network URLs remain forbidden', () => {
  assert.equal(
    containsForbiddenExternalUrl('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    false,
  );
  assert.equal(
    containsForbiddenExternalUrl('<use xmlns:xlink="http://www.w3.org/1999/xlink" />'),
    false,
  );
  assert.equal(containsForbiddenExternalUrl('https://cdn.example/report.js'), true);
});
