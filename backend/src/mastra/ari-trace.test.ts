import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
} from '@ai-sdk/provider';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { executeAriStep, type TraceObservation } from './ari.js';

const EMPTY_USAGE = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

class ParallelRenderModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider = 'work-trace-test';
  readonly modelId = 'parallel-render';
  readonly supportedUrls = {};

  async doGenerate(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4GenerateResult> {
    const hasToolResult = options.prompt.some(
      (message) =>
        message.role === 'tool' ||
        (Array.isArray(message.content) &&
          message.content.some((part) => part.type === 'tool-result')),
    );
    if (hasToolResult) {
      return {
        content: [{ type: 'text', text: 'Both checks completed.' }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: EMPTY_USAGE,
        warnings: [],
      };
    }
    const input = JSON.stringify({ assistantResponse: 'Safe response.' });
    return {
      content: [
        {
          type: 'tool-call',
          toolCallId: 'identical-call-1',
          toolName: 'renderDemoTool',
          input,
        },
        {
          type: 'tool-call',
          toolCallId: 'identical-call-2',
          toolName: 'renderDemoTool',
          input,
        },
      ],
      finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
      usage: EMPTY_USAGE,
      warnings: [],
    };
  }

  async doStream(): Promise<never> {
    throw new Error('generate only');
  }
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('trace hooks preserve configured hooks and correlate overlapping identical calls that settle in reverse', async () => {
  const firstGate = deferred();
  const configuredCalls: string[] = [];
  const settlements: number[] = [];
  let invocations = 0;
  let active = 0;
  let maxActive = 0;
  const tool = createTool({
    id: 'render-json-demo',
    description: 'Return a deterministic response.',
    inputSchema: z.object({ assistantResponse: z.string() }),
    execute: async ({ assistantResponse }) => {
      const invocation = ++invocations;
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (invocation === 1) {
        await firstGate.promise;
      } else {
        setImmediate(firstGate.resolve);
      }
      settlements.push(invocation);
      active -= 1;
      return {
        status: 'completed' as const,
        summary: assistantResponse,
        factPatch: { assistantResponse },
        evidence: [{ id: `safe-${invocation}`, source: 'test' }],
      };
    },
  });
  const agent = new Agent({
    id: 'trace-test-agent',
    name: 'Trace test agent',
    instructions: 'Call both tools.',
    model: new ParallelRenderModel(),
    tools: { renderDemoTool: tool },
    hooks: {
      beforeToolCall: () => {
        configuredCalls.push('before');
      },
      afterToolCall: () => {
        configuredCalls.push('after');
      },
    },
  });
  const observations: TraceObservation[] = [];

  const result = await executeAriStep(
    [{ role: 'user', content: 'Run two identical checks.' }],
    agent,
    { traceSink: { observe: (observation) => observations.push(observation) } },
  );

  assert.equal(result.status, 'completed');
  assert.equal(maxActive, 2, 'the tracer must prove real temporal overlap');
  assert.deepEqual(settlements, [2, 1]);
  assert.deepEqual(configuredCalls, ['before', 'before', 'after', 'after']);
  const started = observations.filter(
    (item): item is Extract<TraceObservation, { type: 'started' }> =>
      item.type === 'started',
  );
  const settled = observations.filter(
    (item): item is Extract<TraceObservation, { type: 'settled' }> =>
      item.type === 'settled',
  );
  assert.equal(started.length, 2);
  assert.equal(settled.length, 2);
  assert.notEqual(started[0].correlation, started[1].correlation);
  assert.equal(settled[0].correlation, started[1].correlation);
  assert.equal(settled[1].correlation, started[0].correlation);
});

test('configured short-circuit emits no false running claim', async () => {
  let toolExecutions = 0;
  const tool = createTool({
    id: 'render-json-demo',
    description: 'Must be blocked.',
    inputSchema: z.object({ assistantResponse: z.string() }),
    execute: async () => {
      toolExecutions += 1;
      throw new Error('blocked tool executed');
    },
  });
  const blockedOutput = {
    status: 'completed' as const,
    summary: 'Blocked safely.',
    factPatch: { assistantResponse: 'Blocked safely.' },
    evidence: [{ id: 'blocked-safe', source: 'test' }],
  };
  const agent = new Agent({
    id: 'blocked-trace-agent',
    name: 'Blocked trace agent',
    instructions: 'Call the tool.',
    model: new ParallelRenderModel(),
    tools: { renderDemoTool: tool },
    hooks: {
      beforeToolCall: () => ({ proceed: false, output: blockedOutput }),
    },
  });
  let observations = 0;

  const result = await executeAriStep(
    [{ role: 'user', content: 'Run the blocked check.' }],
    agent,
    {
      traceSink: {
        observe: () => {
          observations += 1;
          throw new Error('observer unavailable');
        },
      },
    },
  );

  assert.equal(result.status, 'completed');
  assert.equal(toolExecutions, 0);
  assert.equal(observations, 0);
});

test('a throwing observer is isolated while configured before and after hooks still run', async () => {
  let executions = 0;
  const configured: string[] = [];
  const tool = createTool({
    id: 'render-json-demo',
    description: 'Return a safe result.',
    inputSchema: z.object({ assistantResponse: z.string() }),
    execute: async ({ assistantResponse }) => {
      executions += 1;
      return {
        status: 'completed' as const,
        summary: assistantResponse,
        factPatch: { assistantResponse },
        evidence: [{ id: `execution-${executions}`, source: 'test' }],
      };
    },
  });
  const agent = new Agent({
    id: 'observer-failure-agent',
    name: 'Observer failure agent',
    instructions: 'Call both tools.',
    model: new ParallelRenderModel(),
    tools: { renderDemoTool: tool },
    hooks: {
      beforeToolCall: () => {
        configured.push('before');
      },
      afterToolCall: () => {
        configured.push('after');
      },
    },
  });

  const result = await executeAriStep(
    [{ role: 'user', content: 'Run both checks.' }],
    agent,
    {
      traceSink: {
        observe: () => {
          throw new Error('observer unavailable');
        },
      },
    },
  );

  assert.equal(result.status, 'completed');
  assert.equal(executions, 2);
  assert.deepEqual(configured, ['before', 'before', 'after', 'after']);
});

test('configured before and after hook throws retain their original failure semantics', async () => {
  for (const phase of ['before', 'after'] as const) {
    let executions = 0;
    const tool = createTool({
      id: 'render-json-demo',
      description: 'Return a safe result.',
      inputSchema: z.object({ assistantResponse: z.string() }),
      execute: async ({ assistantResponse }) => {
        executions += 1;
        return {
          status: 'completed' as const,
          summary: assistantResponse,
          factPatch: { assistantResponse },
          evidence: [{ id: `throw-${phase}`, source: 'test' }],
        };
      },
    });
    const hookError = new Error(`${phase} hook failed`);
    const agent = new Agent({
      id: `throwing-${phase}-agent`,
      name: `Throwing ${phase} agent`,
      instructions: 'Call both tools.',
      model: new ParallelRenderModel(),
      tools: { renderDemoTool: tool },
      hooks:
        phase === 'before'
          ? { beforeToolCall: () => { throw hookError } }
          : { afterToolCall: () => { throw hookError } },
    });

    const observations: TraceObservation[] = [];
    const result = await executeAriStep(
      [{ role: 'user', content: 'Run the tool.' }],
      agent,
      { traceSink: { observe: (item) => observations.push(item) } },
    );
    assert.equal(result.status, 'completed');
    assert.equal(executions, phase === 'before' ? 0 : 2);
    assert.equal(observations.length, phase === 'before' ? 0 : 4);
  }
});
