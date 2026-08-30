import type { StepResult } from '../contracts/step-result.js';

export const HELLO_STEP_RESULT = {
  status: 'completed',
  summary: 'Hello from Ari',
  factPatch: {
    fixtureId: 'hello-world-v1',
    greeting: 'Hello from Ari',
    executionSteps: [
      {
        id: 'hello-step-1',
        stepNumber: 1,
        kind: 'thinking',
        animationType: 'thinking',
        title: 'Preparing the response',
        detail: 'Validated the request and prepared the demo response.',
        durationMs: 25,
        timestamp: '2026-08-29T20:00:00.000Z',
      },
    ],
  },
  evidence: [
    {
      id: 'hello-tool-fixture',
      source: 'deterministic:hello-tool',
    },
  ],
} satisfies StepResult;
