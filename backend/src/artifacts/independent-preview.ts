import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, normalize, sep } from 'node:path';

import type { VerifiedArtifactBundle } from './authoring-runner.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function safePath(root: string, relativePath: string) {
  if (!relativePath || relativePath.startsWith('/') || relativePath.includes('..')) {
    throw new Error(`Unsafe bundle path: ${relativePath}`);
  }
  const target = normalize(join(root, relativePath));
  if (!target.startsWith(`${normalize(root)}${sep}`)) {
    throw new Error(`Bundle path escaped output directory: ${relativePath}`);
  }
  return target;
}

function mimeType(path: string) {
  const extension = path.slice(path.lastIndexOf('.'));
  return MIME_TYPES[extension] ?? 'application/octet-stream';
}

export async function verifyBundleIndependently(
  bundle: VerifiedArtifactBundle,
  outputDirectory: string,
) {
  await mkdir(outputDirectory, { recursive: true });
  for (const file of bundle.files) {
    const target = safePath(outputDirectory, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.contents);
  }

  const server = createServer(async (request, response) => {
    try {
      const requestedPath = decodeURIComponent(
        new URL(request.url ?? '/', 'http://127.0.0.1').pathname,
      );
      const relativePath = requestedPath === '/'
        ? 'index.html'
        : requestedPath.replace(/^\/+/, '');
      const bytes = await readFile(safePath(outputDirectory, relativePath));
      response.writeHead(200, {
        'content-type': mimeType(relativePath),
        'content-security-policy': "default-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        'x-content-type-options': 'nosniff',
      });
      response.end(bytes);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Independent preview did not bind a TCP port');
    }
    const origin = `http://127.0.0.1:${address.port}`;
    const checkedPaths: string[] = [];

    for (const file of [...bundle.files].sort((a, b) => a.path.localeCompare(b.path))) {
      const response = await fetch(
        file.path === 'index.html' ? `${origin}/` : `${origin}/${file.path}`,
      );
      if (!response.ok) {
        throw new Error(`Independent preview failed to serve ${file.path}: ${response.status}`);
      }
      const served = new Uint8Array(await response.arrayBuffer());
      const expectedHash = createHash('sha256').update(file.contents).digest('hex');
      const servedHash = createHash('sha256').update(served).digest('hex');
      if (servedHash !== expectedHash) {
        throw new Error(`Independent preview changed ${file.path}`);
      }
      checkedPaths.push(file.path);
    }

    const index = await fetch(`${origin}/`).then((response) => response.text());
    return {
      origin,
      checkedPaths,
      indexContainsReportRoot: /data-report-root/.test(index),
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
