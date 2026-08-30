import assert from 'node:assert/strict';
import test from 'node:test';

import { io, type Socket } from 'socket.io-client';

import { HELLO_STEP_RESULT } from '../fixtures/hello.js';
import type { ReportArtifactDescriptor } from '../artifacts/artifact-contracts.js';
import { createFrontendOriginPolicy } from '../artifacts/frontend-origin-policy.js';
import { createNautaServer } from './server.js';

async function connectClient(port: number): Promise<Socket> {
  const socket = io(`http://127.0.0.1:${port}`, {
    forceNew: true,
    transports: ['websocket'],
  });

  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });

  return socket;
}

async function within<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const expired = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`Timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([promise, expired]);
  } finally {
    clearTimeout(timeout);
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

interface IncidentSnapshot {
  incidents: Array<{
    incidentId: string;
    orderId: string;
    type: string;
    severity: 'warning' | 'critical';
    message: string;
    raisedAt: string;
  }>;
}

function nextIncidentSnapshot(
  socket: Socket,
  expectedIncidentCount: number,
): Promise<IncidentSnapshot> {
  return new Promise((resolve) => {
    const onSnapshot = (snapshot: IncidentSnapshot) => {
      if (snapshot.incidents.length !== expectedIncidentCount) return;
      socket.off('incidents:snapshot', onSnapshot);
      resolve(snapshot);
    };

    socket.on('incidents:snapshot', onSnapshot);
  });
}

const acceptedArtifact: ReportArtifactDescriptor = {
  artifactId: '11111111-1111-4111-8111-111111111111',
  revisionId: '22222222-2222-4222-8222-222222222222',
  kind: 'custom-report',
  title: 'Custom logistics report',
  status: 'accepted',
  previewUrl:
    'http://localhost:3001/api/artifacts/11111111-1111-4111-8111-111111111111/revisions/22222222-2222-4222-8222-222222222222/content/',
  createdAt: '2026-08-30T12:00:00.000Z',
};

async function raiseIncident(port: number) {
  return fetch(`http://127.0.0.1:${port}/api/demo/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: '  ORD-2046  ',
      type: '  delay  ',
      severity: 'critical',
      message: '  Carrier reported a 48-hour delay  ',
    }),
  });
}

test('the report generation route validates bounded strict input', async (context) => {
  let calls = 0;
  const server = createNautaServer({
    artifactGenerationService: {
      async generate() {
        calls += 1;
        return acceptedArtifact;
      },
    },
  });
  const port = await server.start(0);
  context.after(() => server.stop());

  for (const body of [
    { requestId: '', prompt: 'Build it' },
    { requestId: 'request-1', prompt: '' },
    { requestId: 'request-1', prompt: 'x'.repeat(1_201) },
    { requestId: 'request-1', prompt: 'Build it', unexpected: true },
  ]) {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/demo/artifacts/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    assert.equal(response.status, 400);
  }

  const oversized = await fetch(
    `http://127.0.0.1:${port}/api/demo/artifacts/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: 'request-2', prompt: 'x'.repeat(129_000) }),
    },
  );
  assert.equal(oversized.status, 413);
  assert.equal(calls, 0);
});

test('duplicate in-flight and completed report requests share one generation result', async (context) => {
  const pending = deferred<ReportArtifactDescriptor>();
  const started = deferred<void>();
  let calls = 0;
  const server = createNautaServer({
    artifactGenerationService: {
      generate: async () => {
        calls += 1;
        started.resolve();
        return pending.promise;
      },
    },
  });
  const port = await server.start(0);
  context.after(() => server.stop());
  const request = () =>
    fetch(`http://127.0.0.1:${port}/api/demo/artifacts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: 'same-browser-request',
        prompt: 'Focus on delayed containers.',
      }),
    });

  const first = request();
  const duplicate = request();
  await within(started.promise, 250);
  assert.equal(calls, 1);
  pending.resolve(acceptedArtifact);

  for (const response of await Promise.all([first, duplicate])) {
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { artifact: acceptedArtifact });
  }
  const completedDuplicate = await request();
  assert.equal(completedDuplicate.status, 201);
  assert.deepEqual(await completedDuplicate.json(), { artifact: acceptedArtifact });
  assert.equal(calls, 1);
});

test('distinct concurrent report requests are rejected before paid work can fan out', async (context) => {
  const pending = deferred<ReportArtifactDescriptor>();
  const started = deferred<void>();
  let calls = 0;
  const server = createNautaServer({
    artifactGenerationService: {
      async generate() {
        calls += 1;
        if (calls === 1) {
          started.resolve();
          return pending.promise;
        }
        return acceptedArtifact;
      },
    },
  });
  const port = await server.start(0);
  context.after(() => server.stop());
  const request = (requestId: string) =>
    fetch(`http://127.0.0.1:${port}/api/demo/artifacts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, prompt: 'Build the accepted report.' }),
    });

  const first = request('paid-request-a');
  await within(started.promise, 250);
  const overloaded = await request('paid-request-b');
  const sameRequest = request('paid-request-a');
  pending.resolve(acceptedArtifact);
  const sameResponses = await Promise.all([first, sameRequest]);

  assert.equal(overloaded.status, 503);
  assert.equal(overloaded.headers.get('retry-after'), '5');
  assert.deepEqual(await overloaded.json(), { error: 'Report generation is busy' });
  assert.equal(calls, 1);
  for (const response of sameResponses) {
    assert.equal(response.status, 201);
  }
  assert.equal(calls, 1);
});

test('report generation failures emit one prompt-free structured diagnostic', async (context) => {
  const diagnostics: unknown[] = [];
  const secretPrompt = 'Show the confidential delayed-container focus.';
  const server = createNautaServer({
    artifactGenerationService: {
      async generate() {
        throw new Error(`validate-browser failed: ${secretPrompt}`);
      },
    },
    artifactFailureLogger: (diagnostic) => diagnostics.push(diagnostic),
  });
  const port = await server.start(0);
  context.after(() => server.stop());

  const response = await fetch(
    `http://127.0.0.1:${port}/api/demo/artifacts/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: 'diagnostic-request-1',
        prompt: secretPrompt,
      }),
    },
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Could not generate report' });
  assert.equal(diagnostics.length, 1);
  assert.deepEqual(diagnostics[0], {
    event: 'artifact_generation_failed',
    requestId: 'diagnostic-request-1',
    stage: 'authoring',
    reason: 'validate_browser_gate_failed',
    errorName: 'Error',
    errorCode: null,
    durationMs: (diagnostics[0] as { durationMs: number }).durationMs,
  });
  assert.equal(
    Number.isInteger((diagnostics[0] as { durationMs: number }).durationMs),
    true,
  );
  assert.equal(JSON.stringify(diagnostics).includes(secretPrompt), false);
});

test('the artifact content route emits bytes and gateway headers without JSON MIME', async (context) => {
  const gatewayCalls: unknown[] = [];
  const server = createNautaServer({
    artifactContentGateway: {
      async get(input) {
        gatewayCalls.push(input);
        return {
          status: 200 as const,
          bytes: new TextEncoder().encode('console.log("accepted")'),
          headers: {
            'Content-Type': 'text/javascript; charset=utf-8',
            'Content-Security-Policy': "default-src 'self'",
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
            'Cross-Origin-Resource-Policy': 'cross-origin',
          },
        };
      },
    },
  });
  const port = await server.start(0);
  context.after(() => server.stop());

  const response = await fetch(
    `http://127.0.0.1:${port}/api/artifacts/11111111-1111-4111-8111-111111111111/revisions/22222222-2222-4222-8222-222222222222/content/assets/app.js`,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await response.text(), 'console.log("accepted")');
  assert.deepEqual(gatewayCalls, [{
    artifactId: '11111111-1111-4111-8111-111111111111',
    revisionId: '22222222-2222-4222-8222-222222222222',
    path: 'assets/app.js',
  }]);
});

test('run:start acknowledges before asynchronous execution completes', async (context) => {
  const step = deferred<unknown>();
  const server = createNautaServer({ executeStep: () => step.promise });
  const port = await server.start(0);
  const client = await connectClient(port);

  context.after(async () => {
    client.disconnect();
    await server.stop();
  });

  const ack = await within(
    client.emitWithAck('run:start', { requestId: 'start-immediate-ack' }),
    250,
  );

  assert.equal(ack.ok, true);
  assert.match(ack.runId, /^[0-9a-f-]+$/i);
  assert.equal(ack.responseMessageId, `assistant-${ack.runId}`);
  assert.notEqual(server.coordinator.getSnapshot(ack.runId).status, 'completed');

  step.resolve(HELLO_STEP_RESULT);
});

test('run:start carries conversation history through the json-render tracer', async (context) => {
  let receivedMessages: unknown;
  const server = createNautaServer({
    executeStep: async (...args: unknown[]) => {
      [receivedMessages] = args;
      return {
        status: 'completed',
        summary: 'I can help with that.',
        factPatch: {
          assistantResponse: 'I can help with that.',
          executionSteps: HELLO_STEP_RESULT.factPatch.executionSteps,
        },
        evidence: [
          {
            id: 'json-render-ui',
            source: 'json-render:dynamic-components',
          },
        ],
      };
    },
  });
  const port = await server.start(0);
  const client = await connectClient(port);

  context.after(async () => {
    client.disconnect();
    await server.stop();
  });

  const completed = new Promise<Record<string, unknown>>((resolve) => {
    client.on('run:event', (envelope) => {
      if (envelope.type === 'run:complete') resolve(envelope);
    });
  });
  const messages = [
    { role: 'user', content: 'Can you help me plan this delivery?' },
  ];
  const startAck = await client.emitWithAck('run:start', {
    requestId: 'chat-turn-1',
    messages,
  });

  assert.equal(startAck.ok, true);
  await within(completed, 250);
  assert.deepEqual(receivedMessages, messages);

  const snapshot = server.coordinator.getSnapshot(startAck.runId);
  assert.equal(snapshot.status, 'completed');
  assert.match(JSON.stringify(snapshot.ui), /I can help with that\./);
  assert.deepEqual(
    Object.values(snapshot.ui?.elements ?? {}).map(({ type }) => type),
    ['AssistantMessage'],
  );
});

test('repeated run:start request identity acknowledges one run and executes once', async (context) => {
  const step = deferred<unknown>();
  let executions = 0;
  const server = createNautaServer({
    executeStep: () => {
      executions += 1;
      return step.promise;
    },
  });
  const port = await server.start(0);
  const firstClient = await connectClient(port);
  const retryClient = await connectClient(port);

  context.after(async () => {
    firstClient.disconnect();
    retryClient.disconnect();
    await server.stop();
  });

  const [firstAck, retryAck] = await Promise.all([
    firstClient.emitWithAck('run:start', { requestId: 'start-retry-1' }),
    retryClient.emitWithAck('run:start', { requestId: 'start-retry-1' }),
  ]);

  assert.equal(firstAck.ok, true);
  assert.equal(retryAck.ok, true);
  assert.equal(retryAck.runId, firstAck.runId);
  assert.equal(retryAck.responseMessageId, firstAck.responseMessageId);
  assert.equal(firstAck.responseMessageId, `assistant-${firstAck.runId}`);

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(executions, 1);

  step.resolve(HELLO_STEP_RESULT);
});

test('run:join recovers a missed live event from an authoritative ui-null snapshot', async (context) => {
  const step = deferred<unknown>();
  const server = createNautaServer({ executeStep: () => step.promise });
  const port = await server.start(0);
  const firstClient = await connectClient(port);
  const secondClient = await connectClient(port);

  context.after(async () => {
    firstClient.disconnect();
    secondClient.disconnect();
    await server.stop();
  });

  const running = new Promise<void>((resolve) => {
    firstClient.on('run:event', (envelope) => {
      if (envelope.type === 'work-trace:replace') resolve();
    });
  });
  const startAck = await firstClient.emitWithAck('run:start', {
    requestId: 'start-join-snapshot',
  });
  await within(running, 250);

  const joinAck = await secondClient.emitWithAck('run:join', {
    runId: startAck.runId,
  });

  assert.equal(joinAck.ok, true);
  assert.equal(joinAck.snapshot.runId, startAck.runId);
  assert.equal(joinAck.snapshot.status, 'running');
  assert.equal(joinAck.snapshot.sequence, 2);
  assert.equal(joinAck.snapshot.ui, null);
  assert.equal(joinAck.snapshot.responseMessageId, startAck.responseMessageId);
  assert.equal(joinAck.snapshot.workTrace.status, 'running');
  assert.equal(joinAck.snapshot.workTrace.steps[0].id, 'trace-step-1');

  step.resolve(HELLO_STEP_RESULT);
});

test('run:join on a completed run returns the authoritative terminal snapshot without replay dependence', async (context) => {
  const server = createNautaServer({
    executeStep: async () => HELLO_STEP_RESULT,
  });
  const port = await server.start(0);
  const initialClient = await connectClient(port);
  const reconnectClient = await connectClient(port);

  context.after(async () => {
    initialClient.disconnect();
    reconnectClient.disconnect();
    await server.stop();
  });

  const completed = new Promise<void>((resolve) => {
    initialClient.on('run:event', (envelope) => {
      if (envelope.type === 'run:complete') resolve();
    });
  });

  const startAck = await initialClient.emitWithAck('run:start', {
    requestId: 'start-rejoin-test',
  });
  await within(completed, 500);

  const joinAck = await reconnectClient.emitWithAck('run:join', {
    runId: startAck.runId,
  });

  assert.equal(joinAck.ok, true);
  assert.equal(joinAck.snapshot.status, 'completed');
  assert.ok(joinAck.snapshot.ui);
  assert.equal(
    joinAck.snapshot.responseMessageId,
    `assistant-${startAck.runId}`,
  );
  assert.equal(
    joinAck.snapshot.uiTargetMessageId,
    `assistant-${startAck.runId}`,
  );
  assert.deepEqual(joinAck.snapshot.workTrace, {
    status: 'completed',
    durationMs: joinAck.snapshot.workTrace.durationMs,
    steps: [
      {
        id: 'trace-step-1',
        stepNumber: 1,
        kind: 'thinking',
        status: 'completed',
        animationType: 'thinking',
        title: 'Entendiendo tu solicitud',
        detail: 'Trabajo observable finalizado.',
      },
    ],
  });
});

test('run:join rejects an unknown stale binding with bounded safe copy', async (context) => {
  const server = createNautaServer();
  const port = await server.start(0);
  context.after(() => server.stop());
  const client = await connectClient(port);
  context.after(() => client.close());

  const staleSentinel = 'stale-provider-secret-run';
  const ack = await client.emitWithAck('run:join', { runId: staleSentinel });

  assert.deepEqual(ack, {
    ok: false,
    error: 'La ejecución ya no está disponible.',
  });
  assert.doesNotMatch(JSON.stringify(ack), /stale-provider-secret-run/);
});

test('conversation teardown releases only the connected projection scope and is idempotent', async (context) => {
  const clearedRunStep = deferred<unknown>();
  const server = createNautaServer({
    executeStep: async (messages) => {
      if (messages[0]?.content === 'scope-a-finishes-after-clear') {
        return clearedRunStep.promise;
      }
      return HELLO_STEP_RESULT;
    },
    composeUi: () => ({
      root: 'assistant-message',
      elements: {
        'assistant-message': {
          type: 'AssistantMessage',
          props: { text: 'Current response shell.' },
          children: ['shared-delivery-card'],
        },
        'shared-delivery-card': {
          type: 'ContainerProgress',
          props: { currentStatus: 'In Transit' },
          children: [],
        },
      },
    }),
  });
  const port = await server.start(0);
  const clientA = await connectClient(port);
  const clientB = await connectClient(port);

  context.after(async () => {
    clientA.disconnect();
    clientB.disconnect();
    await server.stop();
  });

  async function completeRun(client: Socket, requestId: string) {
    const uiReplace = new Promise<Record<string, any>>((resolve) => {
      const onEvent = (envelope: Record<string, any>) => {
        if (envelope.type !== 'ui:replace') return;
        client.off('run:event', onEvent);
        resolve(envelope);
      };
      client.on('run:event', onEvent);
    });
    const acknowledgement = await client.emitWithAck('run:start', {
      requestId,
      messages: [{ role: 'user', content: requestId }],
    });
    assert.equal(acknowledgement.ok, true);
    return {
      acknowledgement,
      envelope: await within(uiReplace, 500),
    };
  }

  const firstA = await completeRun(clientA, 'scope-a-initial');
  const firstB = await completeRun(clientB, 'scope-b-initial');
  const updateA = await completeRun(clientA, 'scope-a-update-before-clear');

  assert.equal(
    updateA.envelope.payload.uiTargetMessageId,
    firstA.acknowledgement.responseMessageId,
    'intentional same-scope older-card updates remain authorized before teardown',
  );

  const clearedRunUi = new Promise<Record<string, any>>((resolve) => {
    const onEvent = (envelope: Record<string, any>) => {
      if (envelope.type !== 'ui:replace') return;
      clientA.off('run:event', onEvent);
      resolve(envelope);
    };
    clientA.on('run:event', onEvent);
  });
  const clearedRunAck = await clientA.emitWithAck('run:start', {
    requestId: 'scope-a-finishes-after-clear',
    messages: [{ role: 'user', content: 'scope-a-finishes-after-clear' }],
  });
  assert.equal(clearedRunAck.ok, true);

  assert.deepEqual(
    await clientA.timeout(250).emitWithAck('conversation:clear', {}),
    { ok: true },
  );
  assert.deepEqual(
    await clientA.timeout(250).emitWithAck('conversation:clear', {}),
    { ok: true },
    'repeated teardown remains idempotent',
  );
  assert.deepEqual(
    await clientA.timeout(250).emitWithAck('conversation:clear', {
      projectionScope: clientB.id,
    }),
    { ok: false, error: 'Invalid conversation:clear command' },
    'the browser cannot name another projection scope',
  );

  clearedRunStep.resolve(HELLO_STEP_RESULT);
  await within(clearedRunUi, 500);

  const afterClearA = await completeRun(clientA, 'scope-a-after-clear');
  assert.equal(
    afterClearA.envelope.payload.uiTargetMessageId,
    afterClearA.acknowledgement.responseMessageId,
  );
  assert.ok(
    afterClearA.envelope.payload.spec.elements['shared-delivery-card'],
    'the final spec remains on the new response shell',
  );

  const updateB = await completeRun(clientB, 'scope-b-update-after-a-clear');
  assert.equal(
    updateB.envelope.payload.uiTargetMessageId,
    firstB.acknowledgement.responseMessageId,
    'clearing one socket scope does not clear another socket scope',
  );
});

test('concurrent runs maintain strict room isolation with no event bleed', async (context) => {
  const server = createNautaServer({
    executeStep: async (messages) => ({
      status: 'completed',
      summary: `Result for ${messages[0]?.content}`,
      factPatch: {
        assistantResponse: `Echo: ${messages[0]?.content}`,
        executionSteps: HELLO_STEP_RESULT.factPatch.executionSteps,
      },
      evidence: [{ id: 'test-evidence', source: 'unit-test' }],
    }),
  });
  const port = await server.start(0);
  const clientA = await connectClient(port);
  const clientB = await connectClient(port);

  context.after(async () => {
    clientA.disconnect();
    clientB.disconnect();
    await server.stop();
  });

  const clientAEvents: unknown[] = [];
  const clientBEvents: unknown[] = [];

  clientA.on('run:event', (env) => clientAEvents.push(env));
  clientB.on('run:event', (env) => clientBEvents.push(env));

  const [ackA, ackB] = await Promise.all([
    clientA.emitWithAck('run:start', {
      requestId: 'concurrent-run-A',
      messages: [{ role: 'user', content: 'Query A' }],
    }),
    clientB.emitWithAck('run:start', {
      requestId: 'concurrent-run-B',
      messages: [{ role: 'user', content: 'Query B' }],
    }),
  ]);

  assert.notEqual(ackA.runId, ackB.runId);

  // Wait for both executions to finish
  await new Promise((r) => setTimeout(r, 200));

  // Client A should only see events with runId === ackA.runId
  assert.ok(clientAEvents.length > 0);
  for (const env of clientAEvents as Array<{ runId: string }>) {
    assert.equal(env.runId, ackA.runId, 'Client A received bleed event from another run');
  }

  // Client B should only see events with runId === ackB.runId
  assert.ok(clientBEvents.length > 0);
  for (const env of clientBEvents as Array<{ runId: string }>) {
    assert.equal(env.runId, ackB.runId, 'Client B received bleed event from another run');
  }
});

test('raising an order incident broadcasts the active snapshot to every client', async (context) => {
  const server = createNautaServer();
  const port = await server.start(0);
  const firstClient = await connectClient(port);
  const secondClient = await connectClient(port);

  context.after(async () => {
    firstClient.disconnect();
    secondClient.disconnect();
    await server.stop();
  });

  const firstSnapshot = nextIncidentSnapshot(firstClient, 1);
  const secondSnapshot = nextIncidentSnapshot(secondClient, 1);
  const response = await raiseIncident(port);

  assert.equal(response.status, 201);
  const incident = (await response.json()) as IncidentSnapshot['incidents'][number];
  assert.match(incident.incidentId, /^[0-9a-f-]{36}$/i);
  assert.equal(incident.orderId, 'ORD-2046');
  assert.equal(incident.type, 'delay');
  assert.equal(incident.severity, 'critical');
  assert.equal(incident.message, 'Carrier reported a 48-hour delay');
  assert.doesNotThrow(() => new Date(incident.raisedAt).toISOString());

  const expected = { incidents: [incident] };
  assert.deepEqual(await within(firstSnapshot, 250), expected);
  assert.deepEqual(await within(secondSnapshot, 250), expected);
});

test('a newly connected client receives the current active incident snapshot', async (context) => {
  const server = createNautaServer();
  const port = await server.start(0);

  context.after(async () => {
    await server.stop();
  });

  const response = await raiseIncident(port);
  assert.equal(response.status, 201);
  const incident = (await response.json()) as IncidentSnapshot['incidents'][number];

  const socket = io(`http://127.0.0.1:${port}`, {
    autoConnect: false,
    forceNew: true,
    transports: ['websocket'],
  });
  context.after(() => socket.disconnect());
  const snapshot = nextIncidentSnapshot(socket, 1);
  socket.connect();

  assert.deepEqual(await within(snapshot, 250), { incidents: [incident] });
});

test('acknowledging an order incident updates every connected client', async (context) => {
  const server = createNautaServer();
  const port = await server.start(0);
  const firstClient = await connectClient(port);
  const secondClient = await connectClient(port);

  context.after(async () => {
    firstClient.disconnect();
    secondClient.disconnect();
    await server.stop();
  });

  const raisedOnFirst = nextIncidentSnapshot(firstClient, 1);
  const raisedOnSecond = nextIncidentSnapshot(secondClient, 1);
  const raiseResponse = await raiseIncident(port);
  const incident = (await raiseResponse.json()) as IncidentSnapshot['incidents'][number];
  await Promise.all([raisedOnFirst, raisedOnSecond]);

  const acknowledgedOnFirst = nextIncidentSnapshot(firstClient, 0);
  const acknowledgedOnSecond = nextIncidentSnapshot(secondClient, 0);
  const acknowledgeResponse = await fetch(
    `http://127.0.0.1:${port}/api/demo/incidents/${incident.incidentId}/acknowledge`,
    { method: 'POST' },
  );

  assert.equal(acknowledgeResponse.status, 200);
  assert.deepEqual(await acknowledgeResponse.json(), { incidents: [] });
  assert.deepEqual(await within(acknowledgedOnFirst, 250), { incidents: [] });
  assert.deepEqual(await within(acknowledgedOnSecond, 250), { incidents: [] });
});

test('resetting order incidents clears every connected client', async (context) => {
  const server = createNautaServer();
  const port = await server.start(0);
  const firstClient = await connectClient(port);
  const secondClient = await connectClient(port);

  context.after(async () => {
    firstClient.disconnect();
    secondClient.disconnect();
    await server.stop();
  });

  const raisedOnFirst = nextIncidentSnapshot(firstClient, 1);
  const raisedOnSecond = nextIncidentSnapshot(secondClient, 1);
  await raiseIncident(port);
  await Promise.all([raisedOnFirst, raisedOnSecond]);

  const resetOnFirst = nextIncidentSnapshot(firstClient, 0);
  const resetOnSecond = nextIncidentSnapshot(secondClient, 0);
  const response = await fetch(
    `http://127.0.0.1:${port}/api/demo/incidents/reset`,
    { method: 'POST' },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { incidents: [] });
  assert.deepEqual(await within(resetOnFirst, 250), { incidents: [] });
  assert.deepEqual(await within(resetOnSecond, 250), { incidents: [] });
});

test('an invalid order incident payload is rejected', async (context) => {
  const server = createNautaServer();
  const port = await server.start(0);

  context.after(async () => {
    await server.stop();
  });

  const response = await fetch(
    `http://127.0.0.1:${port}/api/demo/incidents`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: ' ',
        type: 'delay',
        severity: 'urgent',
        message: 'Carrier reported a delay',
        unexpected: true,
      }),
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: 'Invalid incident payload',
  });
});

test('the incident API answers browser CORS preflight requests', async (context) => {
  const server = createNautaServer();
  const port = await server.start(0);

  context.after(async () => {
    await server.stop();
  });

  const response = await fetch(
    `http://127.0.0.1:${port}/api/demo/incidents/example/acknowledge`,
    {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    },
  );

  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get('access-control-allow-origin'),
    'http://localhost:3000',
  );
  assert.match(response.headers.get('access-control-allow-methods') ?? '', /POST/);
  assert.match(response.headers.get('access-control-allow-methods') ?? '', /OPTIONS/);
  assert.match(
    response.headers.get('access-control-allow-headers') ?? '',
    /Content-Type/i,
  );
});

test('configured exact and Nauta Vercel preview origins share the API CORS policy', async (context) => {
  const server = createNautaServer({
    originPolicy: createFrontendOriginPolicy({
      frontendOrigins: 'https://custom.example',
    }),
  });
  const port = await server.start(0);
  context.after(() => server.stop());

  for (const origin of [
    'https://custom.example',
    'https://maizena-nextwave-pr-42-joshuapzzs-projects.vercel.app',
  ]) {
    const response = await fetch(`http://127.0.0.1:${port}/api/demo/artifacts/generate`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('access-control-allow-credentials'), null);
  }
});
