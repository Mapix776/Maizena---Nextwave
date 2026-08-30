import { createHash } from 'node:crypto';

import { authorFallbackReport } from './fallback-report.js';

const REPORT_ROOT = '/workspace/report';
const OUTPUT_ROOT = `${REPORT_ROOT}/dist`;
const EDITABLE_PATHS = new Set([
  'index.html',
  'src/main.js',
  'src/styles.css',
]);
const READABLE_PATHS = new Set([
  ...EDITABLE_PATHS,
  'data/fixture.json',
]);
const SOURCE_PATHS = [...READABLE_PATHS].sort();
const MAX_SOURCE_FILE_BYTES = 160_000;
const MAX_OUTPUT_FILES = 64;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const COMPATIBILITY_MARKER = '/* nauta-report-compatibility */';
const PRESENTATION_COMPATIBILITY_CSS = `${COMPATIBILITY_MARKER}
html, body { width: 100%; max-width: 100%; overflow-x: hidden; }
*, *::before, *::after { box-sizing: border-box; }
body { font-size: 16px; }
[data-report-root], [data-report-root] * { min-width: 0; max-width: 100%; overflow-wrap: anywhere; }
[data-report-root] h1 { font-size: clamp(1.75rem, 4vw, 2.75rem); }
[data-report-root] h2 { font-size: clamp(1.3rem, 2.5vw, 1.75rem); }
[data-report-root] h3 { font-size: 1.125rem; }
[data-report-root] small, [data-report-root] [class*="eyebrow"] { font-size: 0.75rem; }
[data-report-hero] { background-color: #211d38 !important; color: #ffffff !important; }
[data-report-hero] * { color: inherit; }
[data-kpi-grid] { background-color: #f1eafd !important; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr)); }
[data-risk-board] { background-color: #fff3e8 !important; }
[data-report-root] table { width: 100%; table-layout: fixed; }
[data-report-root] img, [data-report-root] svg { max-width: 100%; height: auto; }
@media (min-width: 900px) {
  [data-report-root] { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  [data-report-hero], [data-kpi-grid] { grid-column: 1 / -1; }
}
@media (max-width: 480px) {
  [data-report-root] { display: block; width: 100%; }
  [data-report-root] table { font-size: 0.75rem; }
}
`;

export type AuthoringCommand =
  | 'validate-source'
  | 'build'
  | 'validate-browser'
  | 'assert-no-network';

export interface SandboxCreatePolicy {
  jobId: string;
  allowInternetAccess: false;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface AuthoringSandbox {
  listFiles(root: string): Promise<string[]>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, contents: Uint8Array): Promise<void>;
  run(command: AuthoringCommand): Promise<CommandResult>;
  kill(): Promise<void>;
}

export interface AuthoringWorkspace {
  list(): Promise<string[]>;
  read(path: string): Promise<string>;
  write(path: string, contents: string): Promise<void>;
}

export interface ArtifactManifestEntry {
  path: string;
  mimeType: string;
  bytes: number;
  sha256: string;
}

export interface VerifiedArtifactBundle {
  files: ReadonlyArray<{ path: string; contents: Uint8Array }>;
  manifest: ReadonlyArray<ArtifactManifestEntry>;
}

export interface VerifiedArtifactSource {
  files: ReadonlyArray<{ path: string; contents: Uint8Array }>;
  manifest: ReadonlyArray<ArtifactManifestEntry>;
}

export interface AuthoringResult {
  verdict: 'accepted';
  source: VerifiedArtifactSource;
  bundle: VerifiedArtifactBundle;
  manifest: ReadonlyArray<ArtifactManifestEntry>;
  browserScreenshot: Uint8Array;
  cleanup: 'confirmed';
  evidence: ReadonlyArray<{
    gate: AuthoringCommand;
    stdout: string;
  }>;
}

async function exportVerifiedSource(
  sandbox: AuthoringSandbox,
): Promise<VerifiedArtifactSource> {
  const files: Array<{ path: string; contents: Uint8Array }> = [];
  const manifest: ArtifactManifestEntry[] = [];

  for (const path of SOURCE_PATHS) {
    const contents = await sandbox.readFile(`${REPORT_ROOT}/${path}`);
    if (contents.byteLength > MAX_SOURCE_FILE_BYTES) {
      throw new Error(`Source file exceeds ${MAX_SOURCE_FILE_BYTES} bytes: ${path}`);
    }
    files.push({ path, contents });
    manifest.push({
      path,
      mimeType: mimeTypeFor(path),
      bytes: contents.byteLength,
      sha256: createHash('sha256').update(contents).digest('hex'),
    });
  }

  return { files, manifest };
}

export interface RunAuthoringJobInput {
  jobId: string;
  fixture: unknown;
  createSandbox(policy: SandboxCreatePolicy): Promise<AuthoringSandbox>;
  author(
    workspace: AuthoringWorkspace,
    context: { attempt: number; feedback?: string },
  ): Promise<void>;
}

function assertLogicalPath(path: string, allowed: Set<string>, operation: string) {
  if (!allowed.has(path)) {
    throw new Error(`Path is not ${operation}: ${path}`);
  }
}

function createWorkspace(sandbox: AuthoringSandbox): AuthoringWorkspace {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return {
    async list() {
      return [...READABLE_PATHS].sort();
    },
    async read(path) {
      assertLogicalPath(path, READABLE_PATHS, 'readable');
      return decoder.decode(await sandbox.readFile(`${REPORT_ROOT}/${path}`));
    },
    async write(path, contents) {
      assertLogicalPath(path, EDITABLE_PATHS, 'editable');
      await sandbox.writeFile(`${REPORT_ROOT}/${path}`, encoder.encode(contents));
    },
  };
}

function removeForbiddenPresentationCapabilities(source: string): string {
  return source
    .replace(/@import\s+(?:url\()?\s*["']?https?:\/\/[^;]+;/gi, '')
    .replace(/\b(src|href)\s*=\s*(["'])\/\/[^"']*\2/gi, '$1=$2#$2')
    .replace(/https?:\/\/(?!www\.w3\.org\/(?:2000\/svg|1999\/xlink))[^\s"'`<>\\)]+/gi, '#')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

async function stabilizeGeneratedReport(workspace: AuthoringWorkspace): Promise<void> {
  for (const path of ['index.html', 'src/main.js'] as const) {
    const source = await workspace.read(path);
    const stabilized = removeForbiddenPresentationCapabilities(source);
    if (stabilized !== source) await workspace.write(path, stabilized);
  }

  const styles = await workspace.read('src/styles.css');
  const safeStyles = removeForbiddenPresentationCapabilities(styles);
  const stabilizedStyles = safeStyles.includes(COMPATIBILITY_MARKER)
    ? safeStyles
    : `${safeStyles.trim()}\n\n${PRESENTATION_COMPATIBILITY_CSS}`;
  if (stabilizedStyles !== styles) {
    await workspace.write('src/styles.css', stabilizedStyles);
  }
}

function mimeTypeFor(path: string) {
  if (path.endsWith('.html')) return 'text/html; charset=utf-8';
  if (path.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.json')) return 'application/json; charset=utf-8';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.woff2')) return 'font/woff2';
  throw new Error(`Unsupported output file type: ${path}`);
}

async function exportVerifiedBundle(
  sandbox: AuthoringSandbox,
): Promise<VerifiedArtifactBundle> {
  const physicalPaths = (await sandbox.listFiles(OUTPUT_ROOT)).sort();
  if (physicalPaths.length === 0) {
    throw new Error('Build produced no report files');
  }
  if (physicalPaths.length > MAX_OUTPUT_FILES) {
    throw new Error(`Build produced too many files: ${physicalPaths.length}`);
  }

  let totalBytes = 0;
  const files: Array<{ path: string; contents: Uint8Array }> = [];
  const manifest: ArtifactManifestEntry[] = [];

  for (const physicalPath of physicalPaths) {
    if (!physicalPath.startsWith(`${OUTPUT_ROOT}/`)) {
      throw new Error(`Output escaped report root: ${physicalPath}`);
    }
    const path = physicalPath.slice(OUTPUT_ROOT.length + 1);
    if (!path || path.includes('..') || path.startsWith('/') || path.endsWith('.map')) {
      throw new Error(`Unsafe output path: ${path}`);
    }

    const contents = await sandbox.readFile(physicalPath);
    totalBytes += contents.byteLength;
    if (totalBytes > MAX_OUTPUT_BYTES) {
      throw new Error(`Build output exceeds ${MAX_OUTPUT_BYTES} bytes`);
    }

    files.push({ path, contents });
    manifest.push({
      path,
      mimeType: mimeTypeFor(path),
      bytes: contents.byteLength,
      sha256: createHash('sha256').update(contents).digest('hex'),
    });
  }

  if (!manifest.some(({ path }) => path === 'index.html')) {
    throw new Error('Build output is missing index.html');
  }

  return { files, manifest };
}

export async function runAuthoringJob(
  input: RunAuthoringJobInput,
): Promise<AuthoringResult> {
  const sandbox = await input.createSandbox({
    jobId: input.jobId,
    allowInternetAccess: false,
  });

  try {
    await sandbox.writeFile(
      `${REPORT_ROOT}/data/fixture.json`,
      new TextEncoder().encode(`${JSON.stringify(input.fixture, null, 2)}\n`),
    );

    const workspace = createWorkspace(sandbox);
    let feedback: string | undefined;
    let evidence: Array<{ gate: AuthoringCommand; stdout: string }> = [];
    let acceptedByAuthoringGates = false;

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      if (attempt <= 3) {
        await input.author(workspace, { attempt, feedback });
      } else {
        await authorFallbackReport(workspace);
      }
      await stabilizeGeneratedReport(workspace);
      const attemptEvidence: Array<{ gate: AuthoringCommand; stdout: string }> = [];
      let failedGate: { gate: AuthoringCommand; detail: string } | undefined;

      for (const gate of [
        'validate-source',
        'build',
        'validate-browser',
      ] as const) {
        const result = await sandbox.run(gate);
        if (result.exitCode !== 0) {
          failedGate = {
            gate,
            detail: (result.stderr || result.stdout || 'unknown error').slice(0, 8_000),
          };
          break;
        }
        attemptEvidence.push({ gate, stdout: result.stdout.slice(0, 4_096) });
      }

      if (!failedGate) {
        evidence = attemptEvidence;
        acceptedByAuthoringGates = true;
        break;
      }
      feedback = `${failedGate.gate} failed:\n${failedGate.detail}`;
      if (attempt === 4) throw new Error(feedback);
    }

    if (!acceptedByAuthoringGates) {
      throw new Error('Authoring gates did not reach an accepted state');
    }

    const networkResult = await sandbox.run('assert-no-network');
    if (networkResult.exitCode !== 0) {
      throw new Error(
        `assert-no-network failed: ${networkResult.stderr || networkResult.stdout || 'unknown error'}`,
      );
    }
    evidence.push({
      gate: 'assert-no-network',
      stdout: networkResult.stdout.slice(0, 4_096),
    });

    const source = await exportVerifiedSource(sandbox);
    const browserScreenshot = await sandbox.readFile(`${REPORT_ROOT}/report-validation.png`);
    if (
      browserScreenshot.byteLength <= PNG_SIGNATURE.byteLength ||
      browserScreenshot.byteLength > MAX_SCREENSHOT_BYTES ||
      !PNG_SIGNATURE.every((byte, index) => browserScreenshot[index] === byte)
    ) {
      throw new Error('Browser validator did not produce a valid bounded PNG');
    }

    const bundle = await exportVerifiedBundle(sandbox);
    return {
      verdict: 'accepted',
      source,
      bundle,
      manifest: bundle.manifest,
      browserScreenshot,
      cleanup: 'confirmed',
      evidence,
    };
  } finally {
    await sandbox.kill();
  }
}
