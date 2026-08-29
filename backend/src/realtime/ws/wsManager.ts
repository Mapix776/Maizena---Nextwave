import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { eventBus } from '../../bus/eventBus.js';
import { BUS_EVENTS } from '../../bus/events.js';

const runSockets = new Map<string, Set<WebSocket>>();

export function initWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url!, 'http://localhost');
    const runId = url.searchParams.get('runId');

    if (!runId) {
      ws.close(1008, 'runId requerido como query param');
      return;
    }

    // Registrar cliente
    if (!runSockets.has(runId)) runSockets.set(runId, new Set());
    runSockets.get(runId)!.add(ws);
    console.log(`[WS] 🔌 Cliente conectado a run=${runId} (total: ${runSockets.get(runId)!.size})`);

    // Reenviar eventos del bus al cliente WebSocket
    const listener = (payload: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    };
    eventBus.on(BUS_EVENTS.RUN_UPDATED(runId), listener);

    // Mensajes del cliente → bus (ej: decisión humana)
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        eventBus.emit(BUS_EVENTS.DECISION_SUBMITTED, { runId, ...msg });
      } catch {
        console.error('[WS] Mensaje inválido recibido:', raw.toString());
      }
    });

    ws.on('close', () => {
      runSockets.get(runId)?.delete(ws);
      if (runSockets.get(runId)?.size === 0) runSockets.delete(runId);
      eventBus.off(BUS_EVENTS.RUN_UPDATED(runId), listener);
      console.log(`[WS] 🔌 Cliente desconectado de run=${runId}`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Error en run=${runId}:`, err.message);
    });
  });

  console.log('[WS] WebSocket server inicializado en /ws?runId=<id>');
}
