import assert from 'node:assert/strict';
import test from 'node:test';

import { Agent } from '@mastra/core/agent';

import {
  ARI_SYSTEM_PROMPT,
  createAriAgent,
  executeAriStep,
} from './ari.js';
import { DeterministicRenderModel } from './models.js';

test('Ari uses the helpful-assistant prompt and returns one render-demo tool result', async () => {
  let toolExecutions = 0;
  const agent = createAriAgent({
    model: new DeterministicRenderModel(),
    onRenderToolExecution: () => {
      toolExecutions += 1;
    },
  });

  assert.ok(agent instanceof Agent);
  assert.ok(
    String(await agent.getInstructions()).startsWith(ARI_SYSTEM_PROMPT),
  );
  assert.match(String(await agent.getInstructions()), /renderDemoTool/);

  const result = await executeAriStep(
    [{ role: 'user', content: 'Please help me.' }],
    agent,
  );

  assert.equal(toolExecutions, 1);
  assert.deepEqual(result, {
    status: 'completed',
    summary: 'I can help with that.',
    factPatch: {
      assistantResponse: 'I can help with that.',
    },
    evidence: [
      {
        id: 'hardcoded-ui-demo',
        source: 'json-render:hardcoded-components',
      },
    ],
  });
});
