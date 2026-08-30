import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { createNautaServer } from './socket/server.js';

for (const envPath of ['.env', 'backend/.env', '../backend/.env']) {
  const fullPath = resolve(process.cwd(), envPath);
  if (existsSync(fullPath)) {
    try {
      loadEnvFile(fullPath);
      break;
    } catch {
      // ignore
    }
  }
}

const server = createNautaServer();
const port = await server.start();

console.log(`Nauta engine tracer listening on http://0.0.0.0:${port}`);
