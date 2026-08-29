import assert from 'node:assert/strict';
import test from 'node:test';

import { Agent } from '@mastra/core/agent';

import { createAriAgent, executeAriStep } from './ari.js';

test('Ari uses one deterministic hello tool and returns its StepResult', async () => {
  let toolExecutions = 0;
  const agent = createAriAgent({
    onHelloToolExecution: () => {
      toolExecutions += 1;
    },
  });

  assert.ok(agent instanceof Agent);

  const result = await executeAriStep(agent);

  assert.equal(toolExecutions, 1);
  assert.deepEqual(result, {
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
  });
});
