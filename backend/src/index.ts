import { createServer } from 'http';
import { createApp } from './api/server.js';
import { env } from './config/env.js';
import { initWebSocket } from './realtime/ws/wsManager.js';
import { eventBus } from './bus/eventBus.js';
import { BUS_EVENTS } from './bus/events.js';

// Registrar agente de render (escucha AGENT_OUTPUT → genera UI)
await import('./ai/agents/render/index.js');

// Listener central para decisiones humanas recibidas por WebSocket
eventBus.on(BUS_EVENTS.DECISION_SUBMITTED, ({ runId, optionId, ...rest }) => {
  console.log(`[Decision] run=${runId} optionId=${optionId}`, rest);
  // TODO: despachar al agente de logística con trigger 'human.decision'
});

const app = createApp();
const server = createServer(app);

initWebSocket(server);

// Render inyecta PORT dinámicamente — nunca hardcodear
const PORT = process.env.PORT ?? env.PORT ?? '3001';

server.listen(PORT, () => {
  const isProduction = env.NODE_ENV === 'production';
  const baseUrl = isProduction
    ? 'https://maizena-nextwave.onrender.com'
    : `http://localhost:${PORT}`;
  const wsProtocol = isProduction ? 'wss' : 'ws';

  console.log(`🚀 Nauta Backend en ${baseUrl}`);
  console.log(`🔌 WebSocket: ${wsProtocol}://${isProduction ? 'maizena-nextwave.onrender.com' : `localhost:${PORT}`}/ws?runId=<id>`);
  console.log(`   Entorno: ${env.NODE_ENV}`);
});
