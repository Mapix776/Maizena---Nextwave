import { loadEnvFile } from 'node:process';

import { createNautaServer } from './socket/server.js';

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const server = createNautaServer();
const port = await server.start();

console.log(`Nauta engine tracer listening on http://0.0.0.0:${port}`);
