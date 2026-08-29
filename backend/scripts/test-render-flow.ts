/**
 * Test E2E: dispara un AGENT_OUTPUT al bus y verifica que el agente
 * de render genere patches por WebSocket.
 *
 * Uso:
 *   npx tsx scripts/test-render-flow.ts
 */
import '../src/ai/agents/render/index.js';
import { eventBus } from '../src/bus/eventBus.js';
import { BUS_EVENTS } from '../src/bus/events.js';

eventBus.emit(BUS_EVENTS.AGENT_OUTPUT, {
  runId: 'test-run-1',
  agentName: 'ari' as const,
  events: [{ severity: 'critical' as const, message: 'Transbordo no planeado, ETA slip 9 días' }],
  uiIntent: {
    focus: 'route_update' as const,
    severity: 'critical' as const,
    data: { origin: 'Vietnam', destination: 'Mexico', delayDays: 9 },
  },
  contextUpdate: { flowStep: 'in_transit' },
});

console.log('[test] AGENT_OUTPUT emitido → esperando patches...');
