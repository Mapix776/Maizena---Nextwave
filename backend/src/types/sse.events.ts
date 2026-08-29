import type { JsonRenderSpec, JsonRenderPatch } from './render.contract.js';

export type SSEEvent =
  | { type: 'ui.chunk';        runId: string; delta: string }           // OpenAI token stream
  | { type: 'ui.patch';        runId: string; patch: JsonRenderPatch }
  | { type: 'ui.spec';         runId: string; spec: JsonRenderSpec }
  | { type: 'agent.step';      runId: string; step: string | undefined; severity: 'normal' | 'warning' | 'critical' }
  | { type: 'decision.needed'; runId: string; question: string; options: { id: string; label: string }[] };
