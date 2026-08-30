import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

import {
  assessSourcePresentation,
  containsForbiddenExternalUrl,
  marksReportReady,
} from './presentation-contract.mjs';

const root = '/workspace/report';
const required = ['index.html', 'src/main.js', 'src/styles.css'];
const allowed = new Set([...required, 'data/fixture.json']);
const maxSourceBytes = 240_000;

async function walk(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink rejected: ${path}`);
    if (entry.isDirectory()) paths.push(...await walk(path));
    if (entry.isFile()) paths.push(relative(root, path));
  }
  return paths;
}

const sourceFiles = (await walk(join(root, 'src'))).map((path) => path.replaceAll('\\', '/'));
for (const path of sourceFiles) {
  if (!allowed.has(path)) throw new Error(`Unexpected source file: ${path}`);
}

let combined = '';
for (const path of required) {
  const file = join(root, path);
  const info = await stat(file);
  if (!info.isFile() || info.size === 0) throw new Error(`Required source is empty: ${path}`);
  if (info.size > maxSourceBytes) throw new Error(`Required source is too large: ${path}`);
  combined += `\n/* ${path} */\n${await readFile(file, 'utf8')}`;
}

const forbidden = [
  [/(?:src|href)\s*=\s*["']\/\//i, 'protocol-relative URL'],
  [/\bfetch\s*\(/, 'fetch'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/\bEventSource\b/, 'EventSource'],
  [/\bsendBeacon\b/, 'sendBeacon'],
  [/\bimport\s*\(/, 'dynamic import'],
  [/\beval\s*\(/, 'eval'],
  [/\bnew\s+Function\b/, 'Function constructor'],
  [/\son[a-z]+\s*=/i, 'inline event handler'],
];

if (containsForbiddenExternalUrl(combined)) {
  throw new Error('Forbidden source capability: external URL');
}

for (const [pattern, label] of forbidden) {
  if (pattern.test(combined)) throw new Error(`Forbidden source capability: ${label}`);
}

const html = await readFile(join(root, 'index.html'), 'utf8');
const main = await readFile(join(root, 'src/main.js'), 'utf8');
const styles = await readFile(join(root, 'src/styles.css'), 'utf8');
if (!/<title>\s*[^<]+\s*<\/title>/i.test(html)) throw new Error('index.html needs a title');
if (!/data-report-root/.test(html)) throw new Error('index.html needs data-report-root');
if (!/src=["'](?:\/|\.\/)?src\/main\.js["']/.test(html)) {
  throw new Error('index.html must load the local src/main.js module');
}
if (!/fixture\.json/.test(main)) throw new Error('main.js must import the frozen fixture');
if (!/fixture\.operation\.reference/.test(main)) {
  throw new Error('main.js must visibly render fixture.operation.reference');
}
if (!marksReportReady(main)) {
  throw new Error('main.js must mark reportReady after rendering');
}

const presentationFailures = assessSourcePresentation({ html, main, styles });
if (presentationFailures.length) {
  throw new Error(`Presentation source contract failed: ${JSON.stringify(presentationFailures)}`);
}

console.log(JSON.stringify({ gate: 'source-policy', required, bytes: Buffer.byteLength(combined) }));
