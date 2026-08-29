export const BUS_EVENTS = {
  DOCUMENT_INGESTED:   'document.ingested',
  AGENT_OUTPUT:        'agent.output',      // agente logística → backend
  RENDER_OUTPUT:       'render.output',     // agente front → backend
  DECISION_SUBMITTED:  'decision.submitted',
  RUN_UPDATED:         (runId: string) => `run:${runId}`,
} as const;
