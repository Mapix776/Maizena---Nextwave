import type { AuthoringWorkspace } from './authoring-runner.js';

const fallbackIndex = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Executive Logistics Control-Tower Report</title>
    <link rel="stylesheet" href="./src/styles.css" />
  </head>
  <body>
    <main id="report" data-report-root></main>
    <script type="module" src="./src/main.js"></script>
  </body>
</html>
`;

const fallbackMain = `import fixture from '../data/fixture.json';

const report = document.querySelector('[data-report-root]');
const number = new Intl.NumberFormat('en-US');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const text = (value) => String(value ?? '').replaceAll('_', ' ').toLowerCase().replace(/(^|\\s)\\S/g, (letter) => letter.toUpperCase());
const section = (name, title) => {
  const node = document.createElement('section');
  node.dataset[name] = '';
  if (title) {
    const heading = document.createElement('h2');
    heading.textContent = title;
    node.append(heading);
  }
  report.append(node);
  return node;
};
const card = (title, value, note) => {
  const node = document.createElement('article');
  const label = document.createElement('small');
  const metric = document.createElement('strong');
  const detail = document.createElement('p');
  label.textContent = title;
  metric.textContent = value;
  detail.textContent = note;
  node.append(label, metric, detail);
  return node;
};

const hero = section('reportHero');
const eyebrow = document.createElement('small');
const title = document.createElement('h1');
const summary = document.createElement('p');
eyebrow.textContent = 'Nauta Logistics · Executive Control Tower';
title.textContent = fixture.operation.reference;
summary.textContent = fixture.operation.origin + ' → ' + fixture.operation.destination + ' · ' + text(fixture.operation.status);
hero.append(eyebrow, title, summary);

const kpis = section('kpiGrid', 'Network at a glance');
kpis.append(
  card('Containers', number.format(fixture.executiveSummary.totalContainers), 'Active in this operation'),
  card('On track', number.format(fixture.executiveSummary.onTrack), 'Moving to plan'),
  card('At risk', number.format(fixture.executiveSummary.atRisk), 'Requires monitoring'),
  card('Estimated value', currency.format(fixture.executiveSummary.estimatedValueUsd), 'Sanitized shipment value'),
);

const risks = section('riskBoard', 'Priority risks');
for (const risk of fixture.risks) {
  risks.append(card(risk.title, text(risk.severity), risk.container + ' · ' + risk.detail));
}

const containers = section('containerMatrix', 'Container matrix');
for (const container of fixture.containers) {
  const eta = date.format(new Date(container.eta));
  containers.append(card(container.number, text(container.status), container.cargo + ' · ETA ' + eta + ' · ' + number.format(container.slipDays) + ' slip days'));
}

const route = section('routeTimeline', 'Route milestones');
for (const milestone of fixture.routeMilestones) {
  route.append(card(milestone.label, milestone.location, date.format(new Date(milestone.at)) + ' · ' + text(milestone.status)));
}

const decision = section('decisionPanel', fixture.pendingDecision.title);
const question = document.createElement('h3');
question.textContent = fixture.pendingDecision.question;
decision.append(question);
for (const option of fixture.pendingDecision.options) {
  const item = document.createElement('p');
  item.textContent = option;
  decision.append(item);
}

const visual = section('reportVisual', 'Risk distribution');
const critical = fixture.containers.filter((item) => item.severity === 'critical').length;
const warning = fixture.containers.filter((item) => item.severity === 'warning').length;
const normal = fixture.containers.filter((item) => item.severity === 'normal').length;
visual.innerHTML = '<svg viewBox="0 0 420 120" role="img" aria-label="Container risk distribution">'
  + '<rect x="10" y="20" width="' + (critical * 90) + '" height="24" rx="8" fill="#d84a67"></rect>'
  + '<rect x="10" y="52" width="' + (warning * 90) + '" height="24" rx="8" fill="#e7a52d"></rect>'
  + '<rect x="10" y="84" width="' + (normal * 90) + '" height="24" rx="8" fill="#35a875"></rect>'
  + '</svg>';

document.body.dataset.reportReady = 'true';
`;

const fallbackStyles = `:root {
  --canvas: #fbf9ff;
  --surface: #ffffff;
  --text: #211d38;
  --muted: #6e6882;
  --accent: #ba46d6;
  --accent-soft: #f1eafd;
  --ok: #218a61;
  --warning: #b87414;
  --critical: #bd3554;
  --border: #e6e0f1;
  --space: 1rem;
  --radius: 16px;
}
* { box-sizing: border-box; }
html, body { margin: 0; max-width: 100%; overflow-x: hidden; }
body { background: var(--canvas); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 16px; }
[data-report-root] { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; width: min(1180px, 100%); margin: 0 auto; padding: 24px; }
section { min-width: 0; max-width: 100%; padding: 20px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); overflow-wrap: anywhere; }
[data-report-hero] { grid-column: 1 / -1; background: var(--text); color: white; }
[data-kpi-grid] { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; background: var(--accent-soft); }
[data-kpi-grid] h2 { grid-column: 1 / -1; }
[data-risk-board] { background: #fff3e8; }
[data-container-matrix] { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
[data-container-matrix] h2 { grid-column: 1 / -1; }
article { min-width: 0; padding: 14px; border-radius: 12px; background: white; border: 1px solid var(--border); }
h1 { margin: 8px 0; font-size: clamp(2rem, 5vw, 3.5rem); line-height: 1; }
h2 { margin: 0 0 14px; font-size: 1.45rem; }
h3 { margin: 12px 0; font-size: 1.1rem; }
small { display: block; color: inherit; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
strong { display: block; margin-top: 8px; font-size: 1.65rem; font-variant-numeric: tabular-nums; }
p { margin: 8px 0 0; color: inherit; line-height: 1.55; }
svg { display: block; width: 100%; height: auto; }
@media (max-width: 720px) {
  [data-report-root] { display: block; width: 100%; padding: 12px; }
  section { width: 100%; margin-bottom: 12px; padding: 16px; }
  [data-kpi-grid], [data-container-matrix] { display: grid; grid-template-columns: 1fr; }
  [data-kpi-grid] h2, [data-container-matrix] h2 { grid-column: auto; }
}
`;

export async function authorFallbackReport(workspace: AuthoringWorkspace): Promise<void> {
  await workspace.write('index.html', fallbackIndex);
  await workspace.write('src/main.js', fallbackMain);
  await workspace.write('src/styles.css', fallbackStyles);
}
