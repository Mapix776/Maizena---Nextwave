import { eventBus } from '../../../bus/eventBus.js';
import { BUS_EVENTS } from '../../../bus/events.js';
import { streamSpec } from './render.agent.js';
import type { AgentOutput } from '../../../types/agent.contract.js';

// Registrar listener: cuando llega output del agente de logística → generar UI
eventBus.on(BUS_EVENTS.AGENT_OUTPUT, async (output: AgentOutput) => {
  try {
    console.log(`[render.agent] 🎨 Generando UI para run=${output.runId}`);
    await streamSpec(output.runId, output.uiIntent);
    console.log(`[render.agent] ✅ Spec completado para run=${output.runId}`);
  } catch (err) {
    console.error(`[render.agent] ❌ Error en run=${output.runId}:`, err);
  }
});
