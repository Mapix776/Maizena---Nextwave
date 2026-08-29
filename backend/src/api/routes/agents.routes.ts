import { Router } from 'express';
import { eventBus } from '../../bus/eventBus.js';
import { BUS_EVENTS } from '../../bus/events.js';
import type { AgentOutput } from '../../types/agent.contract.js';
import type { JsonRenderSpec, JsonRenderPatch } from '../../types/render.contract.js';

const router = Router();

// ─────────────────────────────────────────────
// POST /agents/logistics/output
// El agente de LOGÍSTICA (Ari / Recon) hace POST aquí con su resultado
// ─────────────────────────────────────────────
router.post('/logistics/output', async (req, res) => {
  const output: AgentOutput = req.body;

  if (!output?.runId || !output?.agentName) {
    res.status(400).json({ error: 'runId and agentName are required' });
    return;
  }

  // TODO: persistir contexto en Supabase
  // await runQueries.updateContext(output.runId, output.contextUpdate);

  // TODO: persistir eventos
  // await eventQueries.insertMany(output.runId, output.events);

  // Emitir al bus: lo consume el agente de front y el SSE
  eventBus.emit(BUS_EVENTS.AGENT_OUTPUT, output);
  eventBus.emit(BUS_EVENTS.RUN_UPDATED(output.runId), {
    type: 'agent.step',
    runId: output.runId,
    step: output.contextUpdate.flowStep,
    severity: output.events[0]?.severity ?? 'normal',
  });

  res.status(202).json({ received: true });
});

// ─────────────────────────────────────────────
// POST /agents/render/output
// El agente de FRONT hace POST aquí con el spec o patch generado
// ─────────────────────────────────────────────
router.post('/render/output', async (req, res) => {
  const { runId, spec, patch } = req.body as {
    runId: string;
    spec?: JsonRenderSpec;
    patch?: JsonRenderPatch;
  };

  if (!runId) {
    res.status(400).json({ error: 'runId is required' });
    return;
  }

  if (patch) {
    eventBus.emit(BUS_EVENTS.RUN_UPDATED(runId), { type: 'ui.patch', runId, patch });
  } else if (spec) {
    eventBus.emit(BUS_EVENTS.RUN_UPDATED(runId), { type: 'ui.spec', runId, spec });
  } else {
    res.status(400).json({ error: 'spec or patch is required' });
    return;
  }

  res.status(202).json({ received: true });
});

// Nota: el streaming al cliente ahora va por WebSocket (ws://host/ws?runId=<id>)
// Ver: src/realtime/ws/wsManager.ts

export default router;
