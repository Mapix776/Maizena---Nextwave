import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';

import { Server as SocketServer } from 'socket.io';
import { z } from 'zod';

import {
  ArtifactContentGateway,
  SupabaseArtifactContentRepository,
} from '../artifacts/artifact-content-gateway.js';
import type {
  ArtifactGenerationService,
  ReportArtifactDescriptor,
} from '../artifacts/artifact-contracts.js';
import { E2BArtifactGenerationService } from '../artifacts/artifact-generation-service.js';
import {
  createFrontendOriginPolicy,
  type FrontendOriginPolicy,
} from '../artifacts/frontend-origin-policy.js';
import { RunCoordinator } from '../coordinator/run-coordinator.js';
import { chatMessagesSchema, type ChatMessage } from '../contracts/chat.js';
import { raiseOrderIncidentInputSchema } from '../contracts/order-incident.js';
import type { StepResult } from '../contracts/step-result.js';
import type { TraceSink } from '../mastra/ari.js';
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
import { createDashboardStore } from '../services/dashboard.store.js';
import {
  saveDashboardItemInputSchema,
  updateDashboardItemInputSchema,
} from '../contracts/dashboard.js';
import { ElementLocationTracker } from '../services/element-location-tracker.js';

const joinCommandSchema = z.object({ runId: z.string().min(1) }).strict();
const clearConversationCommandSchema = z.object({}).strict();
const startCommandSchema = z
  .object({
    requestId: z.string().min(1).max(128),
    messages: chatMessagesSchema.optional(),
  })
  .strict();
const generateReportSchema = z
  .object({
    requestId: z.string().trim().min(1).max(128),
    prompt: z.string().trim().min(1).max(1_200),
  })
  .strict();
const MAX_JSON_BODY_BYTES = 128_000;
const MAX_COMPLETED_ARTIFACT_REQUESTS = 256;
const REPORT_GENERATION_RETRY_SECONDS = 5;
let activeReportGenerations = 0;

class ReportGenerationOverloadedError extends Error {}

export interface ArtifactFailureDiagnostic {
  event: 'artifact_generation_failed';
  requestId: string;
  stage: 'accepted_lookup' | 'authoring' | 'publication' | 'generation';
  reason: string;
  errorName: string;
  errorCode: string | null;
  durationMs: number;
}

type ArtifactFailureLogger = (diagnostic: ArtifactFailureDiagnostic) => void;

function boundedErrorChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current && !seen.has(current) && chain.length < 4) {
    chain.push(current);
    seen.add(current);
    current =
      typeof current === 'object' && 'cause' in current
        ? (current as { cause?: unknown }).cause
        : undefined;
  }
  return chain;
}

function safeFailureReason(error: unknown): {
  stage: ArtifactFailureDiagnostic['stage'];
  reason: string;
} {
  for (const item of boundedErrorChain(error)) {
    const message = item instanceof Error ? item.message : '';
    if (/^Accepted artifact lookup failed \(/.test(message)) {
      return { stage: 'accepted_lookup', reason: 'accepted_lookup_failed' };
    }
    if (/^Supabase is not configured\./.test(message)) {
      return { stage: 'accepted_lookup', reason: 'supabase_not_configured' };
    }
    if (/^AI author did not create required source file:/.test(message)) {
      return { stage: 'authoring', reason: 'author_required_file_missing' };
    }
    if (/^validate-source failed:/.test(message)) {
      return { stage: 'authoring', reason: 'validate_source_gate_failed' };
    }
    if (/^build failed:/.test(message)) {
      return { stage: 'authoring', reason: 'build_gate_failed' };
    }
    if (/^validate-browser failed:/.test(message)) {
      return { stage: 'authoring', reason: 'validate_browser_gate_failed' };
    }
    if (/^assert-no-network failed:/.test(message)) {
      return { stage: 'authoring', reason: 'network_gate_failed' };
    }
    if (/^Browser validator did not produce/.test(message)) {
      return { stage: 'authoring', reason: 'browser_evidence_invalid' };
    }
    if (/^(Build produced|Build output|Output escaped|Unsafe output path|Unsupported output file type)/.test(message)) {
      return { stage: 'authoring', reason: 'bundle_export_failed' };
    }
    if (/^Source file exceeds/.test(message)) {
      return { stage: 'authoring', reason: 'source_export_failed' };
    }
    if (/^Storage upload failed \(/.test(message)) {
      return { stage: 'publication', reason: 'storage_upload_failed' };
    }
    if (/^Artifact acceptance (failed|returned)/.test(message)) {
      return { stage: 'publication', reason: 'acceptance_rpc_failed' };
    }
  }
  return { stage: 'generation', reason: 'unclassified' };
}

function safeErrorToken(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(value)
    ? value
    : fallback;
}

function createArtifactFailureDiagnostic(
  requestId: string,
  startedAt: number,
  error: unknown,
): ArtifactFailureDiagnostic {
  const record = error && typeof error === 'object'
    ? (error as { name?: unknown; code?: unknown })
    : {};
  const classified = safeFailureReason(error);
  return {
    event: 'artifact_generation_failed',
    requestId,
    ...classified,
    errorName: safeErrorToken(record.name, 'UnknownError'),
    errorCode:
      record.code === undefined || record.code === null
        ? null
        : safeErrorToken(record.code, 'unclassified'),
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
  };
}

function reportGenerationConcurrency(): number {
  const configured = Number(process.env.REPORT_GENERATION_MAX_CONCURRENCY ?? '1');
  return Number.isInteger(configured) && configured >= 1 && configured <= 4
    ? configured
    : 1;
}

interface NautaServerOptions {
  executeStep?: (
    messages: ChatMessage[],
    options?: { traceSink: TraceSink },
  ) => Promise<unknown>;
  composeUi?: (result: StepResult) => unknown;
  documentStore?: SupabaseDocumentStore;
  artifactGenerationService?: ArtifactGenerationService;
  artifactContentGateway?: Pick<ArtifactContentGateway, 'get'>;
  originPolicy?: FrontendOriginPolicy;
  artifactFailureLogger?: ArtifactFailureLogger;
}

export interface NautaServer {
  coordinator: RunCoordinator;
  start(port?: number): Promise<number>;
  stop(): Promise<void>;
}

export function createNautaServer(options: NautaServerOptions = {}): NautaServer {
  const originPolicy = options.originPolicy ?? createFrontendOriginPolicy();
  const artifactFailureLogger: ArtifactFailureLogger =
    options.artifactFailureLogger ??
    ((diagnostic) => console.error(JSON.stringify(diagnostic)));

  const documentStore = options.documentStore ?? new SupabaseDocumentStore();
  const artifactGenerationService =
    options.artifactGenerationService ?? new E2BArtifactGenerationService();
  const artifactContentGateway =
    options.artifactContentGateway ??
    new ArtifactContentGateway(new SupabaseArtifactContentRepository(), {
      originPolicy,
    });
  const inFlightArtifactRequests = new Map<
    string,
    Promise<ReportArtifactDescriptor>
  >();
  const completedArtifactRequests = new Map<string, ReportArtifactDescriptor>();

  const generateArtifactOnce = (
    requestId: string,
    prompt: string,
  ): Promise<ReportArtifactDescriptor> => {
    const completed = completedArtifactRequests.get(requestId);
    if (completed) return Promise.resolve(completed);
    const inFlight = inFlightArtifactRequests.get(requestId);
    if (inFlight) return inFlight;
    if (activeReportGenerations >= reportGenerationConcurrency()) {
      throw new ReportGenerationOverloadedError('Report generation capacity is full');
    }
    activeReportGenerations += 1;

    const generation = Promise.resolve()
      .then(() => artifactGenerationService.generate({ requestId, prompt }))
      .then((artifact) => {
        inFlightArtifactRequests.delete(requestId);
        if (completedArtifactRequests.size >= MAX_COMPLETED_ARTIFACT_REQUESTS) {
          const oldest = completedArtifactRequests.keys().next().value;
          if (oldest) completedArtifactRequests.delete(oldest);
        }
        completedArtifactRequests.set(requestId, artifact);
        return artifact;
      })
      .catch((error) => {
        inFlightArtifactRequests.delete(requestId);
        throw error;
      })
      .finally(() => {
        activeReportGenerations -= 1;
      });
    inFlightArtifactRequests.set(requestId, generation);
    return generation;
  };
  const incidentStore = createOrderIncidentStore();
  const analyticsService = new AnalyticsService();
  const pinnedChartStore = createPinnedChartStore();
  const dashboardStore = createDashboardStore();
  const httpServer: HttpServer = createServer((request, response) => {
    const origin = request.headers.origin;
    if (originPolicy.isApiOriginAllowed(origin)) {
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
      void analyticsService
        .getAnalytics()
        .then((data) => sendJson(response, 200, data))
        .catch(() => sendJson(response, 500, { error: 'Failed to compute analytics' }));
      return;
    }

    if (
      request.method === 'POST' &&
      request.url === '/api/demo/artifacts/generate'
    ) {
      void (async () => {
        let diagnosticContext:
          | { requestId: string; startedAt: number }
          | undefined;
        try {
          const parsed = generateReportSchema.safeParse(
            await readJsonBody(request, MAX_JSON_BODY_BYTES),
          );
          if (!parsed.success) {
            sendJson(response, 400, { error: 'Invalid report generation payload' });
            return;
          }
          diagnosticContext = {
            requestId: parsed.data.requestId,
            startedAt: performance.now(),
          };
          const artifact = await generateArtifactOnce(
            parsed.data.requestId,
            parsed.data.prompt,
          );
          sendJson(response, 201, { artifact });
        } catch (error) {
          if (error instanceof PayloadTooLargeError) {
            sendJson(response, 413, { error: 'Payload too large' });
            return;
          }
          if (error instanceof ReportGenerationOverloadedError) {
            response.setHeader(
              'Retry-After',
              String(REPORT_GENERATION_RETRY_SECONDS),
            );
            sendJson(response, 503, { error: 'Report generation is busy' });
            return;
          }
          if (diagnosticContext) {
            try {
              artifactFailureLogger(
                createArtifactFailureDiagnostic(
                  diagnosticContext.requestId,
                  diagnosticContext.startedAt,
                  error,
                ),
              );
            } catch {
              // Diagnostics must never replace the controlled HTTP response.
            }
          }
          sendJson(response, 500, { error: 'Could not generate report' });
        }
      })();
      return;
    }

    const contentMatch = request.url
      ? new URL(request.url, 'http://localhost').pathname.match(
          /^\/api\/artifacts\/([^/]+)\/revisions\/([^/]+)\/content(?:\/(.*))?$/,
        )
      : null;
    if (request.method === 'GET' && contentMatch) {
      let path: string;
      try {
        path = decodeURIComponent(contentMatch[3] ?? '');
      } catch {
        sendJson(response, 404, { error: 'Not found' });
        return;
      }
      void artifactContentGateway
        .get({
          artifactId: contentMatch[1],
          revisionId: contentMatch[2],
          path,
        })
        .then((result) => {
          if (result.status === 404) {
            sendJson(response, 404, { error: 'Not found' });
            return;
          }
          for (const [name, value] of Object.entries(result.headers)) {
            response.setHeader(name, value);
          }
          response.writeHead(200);
          response.end(Buffer.from(result.bytes));
        })
        .catch(() => sendJson(response, 404, { error: 'Not found' }));
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
      void readJsonBody(request)
        .then((body) => {
          const parsed = raiseOrderIncidentInputSchema.safeParse(body);

          if (!parsed.success) {
            sendJson(response, 400, { error: 'Invalid incident payload' });
            return;
          }

          const incident = incidentStore.raise(parsed.data);
          io.emit('incidents:snapshot', incidentStore.snapshot());
          sendJson(response, 201, incident);
        })
        .catch((error) => {
          sendJson(response, error instanceof PayloadTooLargeError ? 413 : 400, {
            error: error instanceof PayloadTooLargeError
              ? 'Payload too large'
              : 'Invalid incident payload',
          });
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

    const acknowledgeMatch = request.url?.match(
      /^\/api\/demo\/incidents\/([^/]+)\/acknowledge$/,
    );
    if (request.method === 'POST' && acknowledgeMatch) {
      const snapshot = incidentStore.acknowledge(acknowledgeMatch[1]);
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

    if (
      request.method === 'GET' &&
      request.url === '/api/dashboard/items'
    ) {
      sendJson(response, 200, dashboardStore.list());
      return;
    }

    if (
      request.method === 'POST' &&
      request.url === '/api/dashboard/items'
    ) {
      void readJsonBody(request).then((body) => {
        const parsed = saveDashboardItemInputSchema.safeParse(body);
        if (!parsed.success) {
          sendJson(response, 400, { error: 'Invalid dashboard item payload' });
          return;
        }
        const created = dashboardStore.save(parsed.data);
        io.emit('dashboard:items:snapshot', dashboardStore.list());
        sendJson(response, 201, created);
      });
      return;
    }

    const dashboardItemMatch = request.url?.match(
      /^\/api\/dashboard\/items\/([^/]+)$/,
    );
    if (request.method === 'PUT' && dashboardItemMatch) {
      void readJsonBody(request).then((body) => {
        const parsed = updateDashboardItemInputSchema.safeParse(body);
        if (!parsed.success) {
          sendJson(response, 400, { error: 'Invalid update payload' });
          return;
        }
        const updated = dashboardStore.update(dashboardItemMatch[1], parsed.data);
        if (!updated) {
          sendJson(response, 404, { error: 'Dashboard item not found' });
          return;
        }
        io.emit('dashboard:items:snapshot', dashboardStore.list());
        sendJson(response, 200, updated);
      });
      return;
    }

    if (request.method === 'DELETE' && dashboardItemMatch) {
      const deleted = dashboardStore.delete(dashboardItemMatch[1]);
      io.emit('dashboard:items:snapshot', dashboardStore.list());
      sendJson(response, 200, { ok: true, deleted });
      return;
    }

    response.writeHead(404);
    response.end(JSON.stringify({ error: 'Not found' }));
  });
  const io = new SocketServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        callback(null, originPolicy.isApiOriginAllowed(origin));
      },
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 10000,
    pingInterval: 5000,
  });
  const runIdsByStartRequest = new Map<string, string>();
  const locationTracker = new ElementLocationTracker();
  const coordinator = new RunCoordinator({
    executeStep: options.executeStep,
    composeUi: options.composeUi,
    emit: (envelope) => {
      io.to(roomName(envelope.runId)).emit('run:event', envelope);
    },
    locationTracker,
  });

  io.on('connection', (socket) => {
    let conversationRevision = 0;
    let projectionScope = socket.id;
    socket.emit('incidents:snapshot', incidentStore.snapshot());
    socket.emit('analytics:pinned:snapshot', pinnedChartStore.list());
    socket.emit('dashboard:items:snapshot', dashboardStore.list());

    socket.on('dashboard:item:save', (payload: unknown, ack?: (res: { ok: boolean; item?: unknown; error?: string }) => void) => {
      const parsed = saveDashboardItemInputSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Invalid item payload' });
        return;
      }
      const created = dashboardStore.save(parsed.data);
      io.emit('dashboard:items:snapshot', dashboardStore.list());
      ack?.({ ok: true, item: created });
    });

    socket.on('dashboard:item:delete', (id: string, ack?: (res: { ok: boolean }) => void) => {
      const deleted = dashboardStore.delete(id);
      io.emit('dashboard:items:snapshot', dashboardStore.list());
      ack?.({ ok: deleted });
    });

    socket.on('dashboard:item:resize', (payload: { id: string; size: 'small' | 'medium' | 'large' }, ack?: (res: { ok: boolean }) => void) => {
      const updated = dashboardStore.update(payload.id, { size: payload.size });
      if (updated) {
        io.emit('dashboard:items:snapshot', dashboardStore.list());
        ack?.({ ok: true });
      } else {
        ack?.({ ok: false });
      }
    });

    socket.on('dashboard:item:reorder', (payload: { id: string; order: number }, ack?: (res: { ok: boolean }) => void) => {
      const updated = dashboardStore.update(payload.id, { order: payload.order });
      if (updated) {
        io.emit('dashboard:items:snapshot', dashboardStore.list());
        ack?.({ ok: true });
      } else {
        ack?.({ ok: false });
      }
    });

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

    socket.on('conversation:clear', (command, acknowledge) => {
      const parsed = clearConversationCommandSchema.safeParse(command);
      if (!parsed.success) {
        acknowledge({
          ok: false,
          error: 'Invalid conversation:clear command',
        });
        return;
      }

      locationTracker.clearProjectionScope(projectionScope);
      conversationRevision += 1;
      projectionScope = `${socket.id}:conversation-${conversationRevision}`;
      acknowledge({ ok: true });
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
        acknowledge({
          ok: true,
          runId: existingRunId,
          responseMessageId:
            coordinator.getSnapshot(existingRunId).responseMessageId,
        });
        return;
      }

      const snapshot = coordinator.createRun(projectionScope);
      runIdsByStartRequest.set(parsed.data.requestId, snapshot.runId);
      void socket.join(roomName(snapshot.runId));
      acknowledge({
        ok: true,
        runId: snapshot.runId,
        responseMessageId: snapshot.responseMessageId,
      });

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

      } catch {
        acknowledge({
          ok: false,
          error: 'La ejecución ya no está disponible.',
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

class PayloadTooLargeError extends Error {}

async function readJsonBody(
  request: IncomingMessage,
  maxBytes = MAX_JSON_BODY_BYTES,
): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maxBytes) {
      tooLarge = true;
      continue;
    }
    chunks.push(buffer);
  }
  if (tooLarge) throw new PayloadTooLargeError('Payload too large');

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
