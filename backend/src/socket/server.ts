import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';

import { Server as SocketServer } from 'socket.io';
import { z } from 'zod';

import { RunCoordinator } from '../coordinator/run-coordinator.js';
import { chatMessagesSchema, type ChatMessage } from '../contracts/chat.js';
import { raiseOrderIncidentInputSchema } from '../contracts/order-incident.js';
import type { StepResult } from '../contracts/step-result.js';
import {
  SupabaseDocumentStore,
  saveDocumentInputSchema,
} from '../services/supabase-documents.js';
import { createOrderIncidentStore } from '../services/order-incidents.js';
import { AnalyticsService } from '../services/analytics.service.js';
import { createPinnedChartStore } from '../services/pinned-charts.store.js';
import {
  pinChartInputSchema,
  updatePinnedChartInputSchema,
} from '../contracts/analytics.js';

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
  documentStore?: SupabaseDocumentStore;
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
    'https://maizena-nextwave-frontend.onrender.com',
    'https://maizena-nextwave.onrender.com',
    /^https:\/\/.*\.onrender\.com$/,
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

  const documentStore = options.documentStore ?? new SupabaseDocumentStore();
  const incidentStore = createOrderIncidentStore();
  const analyticsService = new AnalyticsService();
  const pinnedChartStore = createPinnedChartStore();
  const httpServer: HttpServer = createServer((request, response) => {
    const origin = request.headers.origin;
    if (isOriginAllowed(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    response.setHeader('Vary', 'Origin');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');

    // CORS preflight for the browser-facing HTTP endpoints.
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      response.setHeader('Access-Control-Max-Age', '86400');
      response.writeHead(204);
      response.end();
      return;
    }

    if (
      request.method === 'GET' &&
      (request.url === '/healthz' ||
        request.url === '/health' ||
        request.url === '/')
    ) {
      response.writeHead(200);
      response.end(JSON.stringify({ ok: true, status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }

    if (
      request.method === 'GET' &&
      (request.url === '/api/analytics' || request.url === '/analytics')
    ) {
      void analyticsService.getAnalytics().then((data) => {
        response.writeHead(200);
        response.end(JSON.stringify(data));
      }).catch((err) => {
        response.writeHead(500);
        response.end(JSON.stringify({ error: 'Failed to compute analytics', details: String(err) }));
      });
      return;
    }

    if (request.method === 'POST' && request.url === '/documents/save') {
      const chunks: Buffer[] = [];
      let size = 0;
      let aborted = false;

      request.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 128_000) {
          aborted = true;
          response.writeHead(413);
          response.end(JSON.stringify({ ok: false, error: 'Payload too large' }));
          request.destroy();
          return;
        }
        chunks.push(chunk);
      });

      request.on('end', () => {
        if (aborted) return;
        void (async () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf-8');
            const parsed = saveDocumentInputSchema.safeParse(JSON.parse(raw || '{}'));
            if (!parsed.success) {
              response.writeHead(400);
              response.end(JSON.stringify({ ok: false, error: 'Invalid document payload' }));
              return;
            }
            const saved = await documentStore.save(parsed.data);
            response.writeHead(200);
            response.end(JSON.stringify({ ok: true, document: saved }));
          } catch (error) {
            response.writeHead(500);
            response.end(
              JSON.stringify({
                ok: false,
                error: error instanceof Error ? error.message : 'Could not save document',
              }),
            );
          }
        })();
      });
      return;
    }

    if (request.method === 'POST' && request.url === '/api/demo/incidents') {
      void readJsonBody(request).then((body) => {
        const parsed = raiseOrderIncidentInputSchema.safeParse(body);

        if (!parsed.success) {
          sendJson(response, 400, { error: 'Invalid incident payload' });
          return;
        }

        const incident = incidentStore.raise(parsed.data);
        io.emit('incidents:snapshot', incidentStore.snapshot());
        sendJson(response, 201, incident);
      });
      return;
    }

    if (
      request.method === 'POST' &&
      request.url === '/api/demo/incidents/reset'
    ) {
      const snapshot = incidentStore.reset();
      io.emit('incidents:snapshot', snapshot);
      sendJson(response, 200, snapshot);
      return;
    }

    if (
      request.method === 'GET' &&
      request.url === '/api/analytics/pinned'
    ) {
      sendJson(response, 200, pinnedChartStore.list());
      return;
    }

    if (
      request.method === 'POST' &&
      request.url === '/api/analytics/pinned'
    ) {
      void readJsonBody(request).then((body) => {
        const parsed = pinChartInputSchema.safeParse(body);
        if (!parsed.success) {
          sendJson(response, 400, { error: 'Invalid pin chart payload' });
          return;
        }
        const created = pinnedChartStore.add(parsed.data);
        io.emit('analytics:pinned:snapshot', pinnedChartStore.list());
        sendJson(response, 201, created);
      });
      return;
    }

    const pinnedChartMatch = request.url?.match(
      /^\/api\/analytics\/pinned\/([^/]+)$/,
    );
    if (request.method === 'PUT' && pinnedChartMatch) {
      void readJsonBody(request).then((body) => {
        const parsed = updatePinnedChartInputSchema.safeParse(body);
        if (!parsed.success) {
          sendJson(response, 400, { error: 'Invalid update payload' });
          return;
        }
        const updated = pinnedChartStore.update(pinnedChartMatch[1], parsed.data);
        if (!updated) {
          sendJson(response, 404, { error: 'Pinned chart not found' });
          return;
        }
        io.emit('analytics:pinned:snapshot', pinnedChartStore.list());
        sendJson(response, 200, updated);
      });
      return;
    }

    if (request.method === 'DELETE' && pinnedChartMatch) {
      const deleted = pinnedChartStore.delete(pinnedChartMatch[1]);
      io.emit('analytics:pinned:snapshot', pinnedChartStore.list());
      sendJson(response, 200, { ok: true, deleted });
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
    socket.emit('incidents:snapshot', incidentStore.snapshot());
    socket.emit('analytics:pinned:snapshot', pinnedChartStore.list());

    socket.on('analytics:pin', (payload: unknown, ack?: (res: { ok: boolean; chart?: unknown; error?: string }) => void) => {
      const parsed = pinChartInputSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Invalid pin payload' });
        return;
      }
      const created = pinnedChartStore.add(parsed.data);
      io.emit('analytics:pinned:snapshot', pinnedChartStore.list());
      ack?.({ ok: true, chart: created });
    });

    socket.on('analytics:unpin', (id: string, ack?: (res: { ok: boolean }) => void) => {
      const deleted = pinnedChartStore.delete(id);
      io.emit('analytics:pinned:snapshot', pinnedChartStore.list());
      ack?.({ ok: deleted });
    });

    socket.on('analytics:resize', (payload: { id: string; size: 'small' | 'medium' | 'large' }, ack?: (res: { ok: boolean }) => void) => {
      const updated = pinnedChartStore.update(payload.id, { size: payload.size });
      if (updated) {
        io.emit('analytics:pinned:snapshot', pinnedChartStore.list());
        ack?.({ ok: true });
      } else {
        ack?.({ ok: false });
      }
    });

    socket.on('analytics:reorder', (payload: { id: string; order: number }, ack?: (res: { ok: boolean }) => void) => {
      const updated = pinnedChartStore.update(payload.id, { order: payload.order });
      if (updated) {
        io.emit('analytics:pinned:snapshot', pinnedChartStore.list());
        ack?.({ ok: true });
      } else {
        ack?.({ ok: false });
      }
    });

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

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return undefined;
  }
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status);
  response.end(JSON.stringify(body));
}

function roomName(runId: string): string {
  return `run:${runId}`;
}
