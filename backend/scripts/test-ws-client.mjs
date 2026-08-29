/**
 * Cliente WS mínimo para ver los patches llegar en tiempo real.
 *
 * Uso (con el server corriendo):
 *   node scripts/test-ws-client.mjs
 */
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3001/ws?runId=test-run-1');

ws.on('open', () => {
  console.log('[WS Client] ✅ Conectado, esperando mensajes...');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log(`[WS Client] 📦 type=${msg.type}`, JSON.stringify(msg).slice(0, 200));
});

ws.on('error', (err) => {
  console.error('[WS Client] ❌ Error:', err.message);
});

ws.on('close', () => {
  console.log('[WS Client] 🔌 Desconectado');
});
