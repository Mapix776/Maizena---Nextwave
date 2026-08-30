import assert from 'node:assert/strict';
import test from 'node:test';

import { io, type Socket } from 'socket.io-client';

import { HELLO_STEP_RESULT } from '../fixtures/hello.js';
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

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(executions, 1);

  step.resolve(HELLO_STEP_RESULT);
});

test('run:join joins a second client and acknowledges with the current snapshot', async (context) => {
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
      if (envelope.type === 'run:status') resolve();
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
  assert.equal(joinAck.snapshot.sequence, 1);
  assert.equal(joinAck.snapshot.ui, null);
  assert.equal(joinAck.snapshot.workTrace, null);

  step.resolve(HELLO_STEP_RESULT);
});

test('run:join on completed run immediately replays ui:replace event to reconnected client', async (context) => {
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

  const replayedEvent = new Promise<unknown>((resolve) => {
    reconnectClient.on('run:event', (envelope) => {
      if (envelope.type === 'ui:replace') resolve(envelope);
    });
  });

  const joinAck = await reconnectClient.emitWithAck('run:join', {
    runId: startAck.runId,
  });

  assert.equal(joinAck.ok, true);
  assert.equal(joinAck.snapshot.status, 'completed');
  assert.ok(joinAck.snapshot.ui);
  assert.equal(joinAck.snapshot.targetMessageId, `assistant-${startAck.runId}`);
  assert.deepEqual(joinAck.snapshot.workTrace, {
    durationMs: joinAck.snapshot.workTrace.durationMs,
    steps: [
      {
        id: 'hello-step-1',
        stepNumber: 1,
        kind: 'thinking',
        title: 'Preparing the response',
        detail: 'Validated the request and prepared the demo response.',
      },
    ],
  });

  const envelope = (await within(replayedEvent, 500)) as {
    type: string;
    payload: { reason: string; workTrace: unknown; targetMessageId?: string };
  };
  assert.equal(envelope.type, 'ui:replace');
  assert.equal(envelope.payload.reason, 'rejoin-replay');
  assert.deepEqual(envelope.payload.workTrace, joinAck.snapshot.workTrace);
  assert.equal(envelope.payload.targetMessageId, joinAck.snapshot.targetMessageId);
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
