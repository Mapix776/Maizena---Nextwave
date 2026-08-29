import assert from 'node:assert/strict';
import test from 'node:test';

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { createAriAgent } from './ari.js';
import { DeterministicRenderModel } from './models.js';
import {
  createSubagentRegistry,
  defineSubagentRegistry,
} from './subagents/registry.js';
import { createToolRegistry, selectTools } from './tools/registry.js';

test('tool and sub-agent registries keep child-only tools off Ari', async () => {
  const privateTool = createTool({
    id: 'child-private-tool',
    description: 'A test-only capability owned by the child agent.',
    inputSchema: z.object({}),
    execute: async () => ({ ok: true }),
  });
  const toolRegistry = {
    ...createToolRegistry(),
    privateTool,
  };
  const childAgent = new Agent({
    id: 'child-agent',
    name: 'Child agent',
    description: 'Owns one private test tool.',
    instructions: 'Use only your assigned tools.',
    model: new DeterministicRenderModel(),
    tools: selectTools(toolRegistry, ['privateTool']),
  });
  const ari = createAriAgent({
    model: new DeterministicRenderModel(),
    toolRegistry,
    subagentRegistry: defineSubagentRegistry({ childAgent }),
  });

  assert.deepEqual(Object.keys(await ari.listTools()), ['renderDemoTool']);
  assert.deepEqual(Object.keys(await childAgent.listTools()), ['privateTool']);
  assert.deepEqual(Object.keys(await ari.listAgents()), ['childAgent']);
});

test('the default registry gives Ari a document-reconciliation specialist', async () => {
  const model = new DeterministicRenderModel();
  const toolRegistry = createToolRegistry();
  const subagentRegistry = createSubagentRegistry({ model, toolRegistry });
  const ari = createAriAgent({ model, toolRegistry, subagentRegistry });

  assert.deepEqual(Object.keys(await ari.listAgents()), ['reconAgent']);
  assert.deepEqual(Object.keys(await ari.listTools()), ['renderDemoTool']);

  const reconAgent = (await ari.listAgents()).reconAgent;
  assert.ok(reconAgent instanceof Agent);
  assert.match(reconAgent.getDescription(), /Bill of Lading/i);
  assert.deepEqual(Object.keys(await reconAgent.listTools()), [
    'reconcileShipmentDocumentsTool',
  ]);
});
