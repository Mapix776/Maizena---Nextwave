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
    client.emitWithAck('run:start', {}),
    250,
  );

  assert.equal(ack.ok, true);
  assert.match(ack.runId, /^[0-9a-f-]+$/i);
  assert.notEqual(server.coordinator.getSnapshot(ack.runId).status, 'completed');

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
  const startAck = await firstClient.emitWithAck('run:start', {});
  await within(running, 250);

  const joinAck = await secondClient.emitWithAck('run:join', {
    runId: startAck.runId,
  });

  assert.equal(joinAck.ok, true);
  assert.equal(joinAck.snapshot.runId, startAck.runId);
  assert.equal(joinAck.snapshot.status, 'running');
  assert.equal(joinAck.snapshot.sequence, 1);
  assert.equal(joinAck.snapshot.ui, null);

  step.resolve(HELLO_STEP_RESULT);
});
