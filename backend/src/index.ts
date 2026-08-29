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

server.listen(env.PORT, () => {
  console.log(`🚀 Nauta Backend en http://localhost:${env.PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${env.PORT}/ws?runId=<id>`);
  console.log(`   Entorno: ${env.NODE_ENV}`);
});
