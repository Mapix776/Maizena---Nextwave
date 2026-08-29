import type { StepResult } from '../contracts/step-result.js';

export const HELLO_STEP_RESULT = {
  status: 'completed',
  summary: 'Hello from Ari',
  factPatch: {
    fixtureId: 'hello-world-v1',
    greeting: 'Hello from Ari',
  },
  evidence: [
    {
      id: 'hello-tool-fixture',
      source: 'deterministic:hello-tool',
    },
  ],
} satisfies StepResult;
