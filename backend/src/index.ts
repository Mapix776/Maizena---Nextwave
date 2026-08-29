import { createNautaServer } from './socket/server.js';

const server = createNautaServer();
const port = await server.start();

console.log(`Nauta engine tracer listening on http://0.0.0.0:${port}`);
