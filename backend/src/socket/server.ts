import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { Server as SocketServer } from 'socket.io';
import { z } from 'zod';

import { RunCoordinator } from '../coordinator/run-coordinator.js';
import { chatMessagesSchema, type ChatMessage } from '../contracts/chat.js';
import type { StepResult } from '../contracts/step-result.js';

const joinCommandSchema = z.object({ runId: z.string().min(1) }).strict();
const startCommandSchema = z
  .object({
    requestId: z.string().min(1).max(128),
    messages: chatMessagesSchema.optional(),
  })
  .strict();

interface NautaServerOptions {
  executeStep?: (messages: ChatMessage[]) => Promise<unknown>;
  composeUi?: (result: StepResult) => unknown;
}

export interface NautaServer {
  coordinator: RunCoordinator;
  start(port?: number): Promise<number>;
  stop(): Promise<void>;
}

export function createNautaServer(options: NautaServerOptions = {}): NautaServer {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://maizena-nextwave.vercel.app',
    'https://maizena-nextwave-git-main-joshuapzzs-projects.vercel.app',
    /^https:\/\/maizena-nextwave-.*\.vercel\.app$/,
  ];

  const isOriginAllowed = (origin?: string) => {
    if (!origin) return true;
    return allowedOrigins.some((allowed) =>
      allowed instanceof RegExp ? allowed.test(origin) : allowed === origin,
    );
  };

  const httpServer: HttpServer = createServer((request, response) => {
    const origin = request.headers.origin;
    if (isOriginAllowed(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    response.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (request.method === 'GET' && (request.url === '/healthz' || request.url === '/health' || request.url === '/')) {
      response.writeHead(200);
      response.end(JSON.stringify({ ok: true, status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }

    response.writeHead(404);
    response.end(JSON.stringify({ error: 'Not found' }));
  });
  const io = new SocketServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        callback(null, isOriginAllowed(origin));
      },
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 10000,
    pingInterval: 5000,
  });
  const runIdsByStartRequest = new Map<string, string>();
  const coordinator = new RunCoordinator({
    executeStep: options.executeStep,
    composeUi: options.composeUi,
    emit: (envelope) => {
      io.to(roomName(envelope.runId)).emit('run:event', envelope);
    },
  });

  io.on('connection', (socket) => {
    socket.on('run:start', (command, acknowledge) => {
      const parsed = startCommandSchema.safeParse(command);

      if (!parsed.success) {
        acknowledge({ ok: false, error: 'Invalid run:start command' });
        return;
      }

      const existingRunId = runIdsByStartRequest.get(parsed.data.requestId);

      if (existingRunId) {
        void socket.join(roomName(existingRunId));
        acknowledge({ ok: true, runId: existingRunId });
        return;
      }

      const snapshot = coordinator.createRun();
      runIdsByStartRequest.set(parsed.data.requestId, snapshot.runId);
      void socket.join(roomName(snapshot.runId));
      acknowledge({ ok: true, runId: snapshot.runId });

      setImmediate(() => {
        void coordinator.execute(
          snapshot.runId,
          parsed.data.messages ?? [
            { role: 'user', content: 'Run the json-render demo.' },
          ],
        );
      });
    });

    socket.on('run:join', (command, acknowledge) => {
      const parsed = joinCommandSchema.safeParse(command);

      if (!parsed.success) {
        acknowledge({ ok: false, error: 'Invalid run:join command' });
        return;
      }

      try {
        void socket.join(roomName(parsed.data.runId));
        const snapshot = coordinator.getSnapshot(parsed.data.runId);
        acknowledge({
          ok: true,
          snapshot,
        });

        if (snapshot.ui) {
          socket.emit('run:event', {
            runId: snapshot.runId,
            sequence: snapshot.sequence,
            type: 'ui:replace',
            timestamp: new Date().toISOString(),
            payload: {
              uiVersion: 1,
              reason: 'rejoin-replay',
              spec: snapshot.ui,
              traceSteps: (snapshot.facts.executionSteps as unknown[]) || [],
            },
          });
        }
      } catch (error) {
        acknowledge({
          ok: false,
          error: error instanceof Error ? error.message : 'Unable to join run',
        });
      }
    });
  });

  return {
    coordinator,
    async start(port = Number(process.env.PORT ?? 3001)) {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => reject(error);
        httpServer.once('error', onError);
        httpServer.listen(port, '0.0.0.0', () => {
          httpServer.off('error', onError);
          resolve();
        });
      });

      return (httpServer.address() as AddressInfo).port;
    },
    async stop() {
      if (!httpServer.listening) {
        return;
      }

      await new Promise<void>((resolve) => {
        io.close(() => resolve());
      });
    },
  };
}

function roomName(runId: string): string {
  return `run:${runId}`;
}
