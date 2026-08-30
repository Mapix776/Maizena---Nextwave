import assert from 'node:assert/strict';
import test from 'node:test';

import { createAriAgent } from './ari.js';
import {
  DEFAULT_MAIN_MODEL_ID,
  DEFAULT_SMALL_MODEL_ID,
  DeterministicRenderModel,
  MAIN_REASONING_EFFORT,
  SMALL_REASONING_EFFORT,
} from './models.js';

interface InstructionMessage {
  content: string;
  providerOptions?: unknown;
}

test('production agents use Luna with separate reasoning budgets', async () => {
  assert.equal(DEFAULT_MAIN_MODEL_ID, 'gpt-5.6-luna');
  assert.equal(DEFAULT_SMALL_MODEL_ID, 'gpt-5.6-luna');
  assert.equal(MAIN_REASONING_EFFORT, 'medium');
  assert.equal(SMALL_REASONING_EFFORT, 'none');

  const deterministicModel = new DeterministicRenderModel();
  const ari = createAriAgent({
    model: deterministicModel,
    smallModel: deterministicModel,
  });
  const ariInstructions =
    (await ari.getInstructions()) as InstructionMessage;
  assert.deepEqual(ariInstructions.providerOptions, {
    openai: { reasoningEffort: 'medium' },
  });

  const recon = (await ari.listAgents()).reconAgent;
  const reconInstructions =
    (await recon.getInstructions()) as InstructionMessage;
  assert.deepEqual(reconInstructions.providerOptions, {
    openai: { reasoningEffort: 'none' },
  });
});
