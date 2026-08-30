function isTransparent(color) {
  return !color || color === 'transparent' || /rgba\([^)]*,\s*0\s*\)$/.test(color);
}

export function marksReportReady(main) {
  return /dataset\.reportReady\s*=\s*(?:["']true["']|true\b)/.test(main)
    || /setAttribute\s*\(\s*["']data-report-ready["']\s*,\s*(?:["']true["']|true)\s*\)/.test(main);
}

export function containsForbiddenExternalUrl(source) {
  const withoutInertNamespaces = source
    .replaceAll('http://www.w3.org/2000/svg', '')
    .replaceAll('http://www.w3.org/1999/xlink', '');
  return /https?:\/\//i.test(withoutInertNamespaces);
}

export function assessSourcePresentation({ html, main, styles }) {
  const failures = [];
  const rootBlock = styles.match(/:root\s*\{([\s\S]*?)\}/i)?.[1] ?? '';
  const tokens = rootBlock.match(/--[a-z0-9_-]+\s*:/gi) ?? [];
  if (tokens.length < 10) failures.push('missing-design-tokens');
  if (!/body\s*(?:,[^{]+)?\{[^}]*font-family\s*:/is.test(styles)) {
    failures.push('missing-explicit-typography');
  }
  if (!/@media\s*\(/i.test(styles)) failures.push('missing-responsive-layout');
  if (
    !/Intl\.NumberFormat\s*\(/.test(main)
    && !/\.toLocaleString\s*\(\s*["'][a-z]{2}(?:-[A-Z]{2})?["']/.test(main)
  ) failures.push('missing-number-formatter');
  if (!/Intl\.DateTimeFormat\s*\(/.test(main)) failures.push('missing-date-formatter');
  return failures;
}

export function assessRenderedPresentation(snapshot) {
  const failures = [];
  if (snapshot.horizontalOverflow) failures.push('horizontal-overflow');
  if (!snapshot.bodyFontFamily || /^(?:Times|serif\b)/i.test(snapshot.bodyFontFamily)) {
    failures.push('default-typography');
  }
  if (isTransparent(snapshot.bodyBackgroundColor)) failures.push('default-background');
  if (new Set(snapshot.visibleFontSizes).size < 4) failures.push('weak-type-hierarchy');
  if (new Set(snapshot.visibleBackgroundColors.filter((color) => !isTransparent(color))).size < 3) {
    failures.push('weak-color-system');
  }
  if (snapshot.viewport === 'desktop' && snapshot.multiColumnGridCount < 1) {
    failures.push('missing-desktop-grid');
  }
  if (snapshot.kpiCount < 4) failures.push('insufficient-kpis');

  if (snapshot.visualShapeCount < 3 && snapshot.visualPrimitiveCount < 3) {
    failures.push('missing-data-visualization');
  }

  const visibleContainers = new Set(snapshot.visibleContainerIds);
  for (const containerId of snapshot.expectedContainerIds) {
    if (!visibleContainers.has(containerId)) failures.push(`missing-container:${containerId}`);
  }
  if (/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/.test(snapshot.visibleText)) {
    failures.push('raw-enum-label');
  }
  for (const value of snapshot.unformattedNumbers ?? []) {
    failures.push(`unformatted-number:${value}`);
  }

  return failures;
}
