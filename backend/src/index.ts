import { createServer } from 'http';
import { createApp } from './api/server.js';
import { env } from './config/env.js';
import { initWebSocket } from './realtime/ws/wsManager.js';
import { eventBus } from './bus/eventBus.js';
import { BUS_EVENTS } from './bus/events.js';

// Mock del agente de front (solo en modo dev/demo)
if (env.NODE_ENV === 'development' && process.env.MOCK_RENDER === 'true') {
  await import('./scripts/mock-render-agent.js');
  console.log('🎭 Mock render agent activo');
}

// Listener central para decisiones humanas recibidas por WebSocket
eventBus.on(BUS_EVENTS.DECISION_SUBMITTED, ({ runId, optionId, ...rest }) => {
  console.log(`[Decision] run=${runId} optionId=${optionId}`, rest);
  // TODO: despachar al agente de logística con trigger 'human.decision'
});

const app = createApp();
const server = createServer(app);

// WebSocket montado sobre el mismo server HTTP
initWebSocket(server);

server.listen(env.PORT, () => {
  console.log(`🚀 Nauta Backend en http://localhost:${env.PORT}`);
  console.log(`🔌 WebSocket disponible en ws://localhost:${env.PORT}/ws?runId=<id>`);
  console.log(`   Entorno: ${env.NODE_ENV}`);
});
