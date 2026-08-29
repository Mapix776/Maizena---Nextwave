/**
 * Mock del agente de front — para probar el pipeline backend→SSE
 * sin esperar al equipo de front.
 *
 * Activa con: MOCK_RENDER=true npm run dev
 *
 * Escucha AGENT_OUTPUT y "genera" un spec falso que el front recibiría por SSE.
 */
import { eventBus } from '../bus/eventBus.js';
import { BUS_EVENTS } from '../bus/events.js';
import type { AgentOutput } from '../types/agent.contract.js';
import type { JsonRenderSpec } from '../types/render.contract.js';

eventBus.on(BUS_EVENTS.AGENT_OUTPUT, (output: AgentOutput) => {
  console.log(`[MockRenderAgent] 🎨 Generando spec para run ${output.runId}`);

  const spec: JsonRenderSpec = {
    root: 'main',
    elements: {
      main: {
        type: 'Card',
        props: { title: `Run: ${output.runId}`, agent: output.agentName },
        children: ['status', 'alert'],
      },
      status: {
        type: 'StatusBadge',
        props: {
          focus: output.uiIntent.focus,
          severity: output.uiIntent.severity,
        },
      },
      alert: {
        type: 'Alert',
        props: {
          severity: output.events[0]?.severity ?? 'normal',
          message: output.events[0]?.message ?? 'Sin eventos',
        },
      },
    },
  };

  // Simular latencia del agente de front (~300ms)
  setTimeout(() => {
    eventBus.emit(BUS_EVENTS.RUN_UPDATED(output.runId), {
      type: 'ui.spec',
      runId: output.runId,
      spec,
    });
    console.log(`[MockRenderAgent] ✅ Spec emitido para run ${output.runId}`);
  }, 300);
});
