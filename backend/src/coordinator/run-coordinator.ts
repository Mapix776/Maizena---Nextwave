import { randomUUID } from 'node:crypto';

import type { ChatMessage } from '../contracts/chat.js';
import { stepResultSchema, type StepResult } from '../contracts/step-result.js';
import {
  mapToolToTraceStart,
  mapToolToTraceStep,
} from '../contracts/trace-step.js';
import {
  createWorkTrace,
  extractWorkTraceSources,
  type ExecutionTraceStep,
  type WorkTrace,
} from '../contracts/work-trace.js';
import {
  type RunSnapshot,
  type TracerSpec,
  type UIEnvelope,
  validateTracerSpec,
} from '../contracts/ui.js';
import {
  executeAriStep,
  type TraceObservation,
  type TraceSink,
} from '../mastra/ari.js';
import { composeRunUi } from '../services/ui-composer.js';
import {
  defaultSpeculativeEngine,
  SpeculativeEngine,
} from '../services/speculative-engine.js';
import {
  defaultElementLocationTracker,
  ElementLocationTracker,
} from '../services/element-location-tracker.js';

interface RunCoordinatorOptions {
  executeStep?: (
    messages: ChatMessage[],
    options?: { traceSink: TraceSink },
  ) => Promise<unknown>;
  composeUi?: (result: StepResult) => unknown;
  emit?: (envelope: UIEnvelope) => void | Promise<void>;
  createRunId?: () => string;
  now?: () => Date;
  clock?: () => number;
  speculativeEngine?: SpeculativeEngine;
  locationTracker?: ElementLocationTracker;
}

interface CoordinatorRun {
  snapshot: RunSnapshot;
  projectionScope: string;
  startedAt: number | null;
  traceSteps: ExecutionTraceStep[];
  correlations: Map<object, number>;
  commitTail: Promise<void>;
}

export class RunCoordinator {
  readonly #runs = new Map<string, CoordinatorRun>();
  readonly #executeStep: (
    messages: ChatMessage[],
    options?: { traceSink: TraceSink },
  ) => Promise<unknown>;
  readonly #composeUi: (result: StepResult) => unknown;
  readonly #emit: (envelope: UIEnvelope) => void | Promise<void>;
  readonly #createRunId: () => string;
  readonly #now: () => Date;
  readonly #clock: () => number;
  readonly #speculativeEngine: SpeculativeEngine;
  readonly #locationTracker: ElementLocationTracker;

  constructor(options: RunCoordinatorOptions = {}) {
    this.#executeStep =
      options.executeStep ??
      ((messages, executeOptions) =>
        executeAriStep(messages, undefined, executeOptions));
    this.#composeUi = options.composeUi ?? composeRunUi;
    this.#emit = options.emit ?? (() => undefined);
    this.#createRunId = options.createRunId ?? randomUUID;
    this.#now = options.now ?? (() => new Date());
    this.#clock = options.clock ?? (() => performance.now());
    this.#speculativeEngine = options.speculativeEngine ?? defaultSpeculativeEngine;
    this.#locationTracker = options.locationTracker ?? defaultElementLocationTracker;
  }

  createRun(projectionScope = 'default'): RunSnapshot {
    const runId = this.#createRunId();
    const snapshot: RunSnapshot = {
      runId,
      status: 'pending',
      sequence: 0,
      facts: {},
      ui: null,
      workTrace: null,
      responseMessageId: `assistant-${runId}`,
    };
    this.#runs.set(snapshot.runId, {
      snapshot,
      projectionScope,
      startedAt: null,
      traceSteps: [],
      correlations: new Map(),
      commitTail: Promise.resolve(),
    });
    return this.getSnapshot(snapshot.runId);
  }

  getSnapshot(runId: string): RunSnapshot {
    const run = this.#runs.get(runId);

    if (!run) {
      throw new Error(`Unknown run: ${runId}`);
    }

    return structuredClone(run.snapshot);
  }

  async execute(
    runId: string,
    messages: ChatMessage[] = [
      { role: 'user', content: 'Run the json-render demo.' },
    ],
  ): Promise<void> {
    const run = this.#getMutableRun(runId);
    run.startedAt = this.#clock();
    const t0 = performance.now();
    const logTiming = (evento: string) => {
      const ms = Math.round(performance.now() - t0);
      console.log(`[timing] runId=${runId} evento=${evento} ms_desde_inicio=${ms}`);
    };

    logTiming('uiIntent_received');
    await this.#commit(run, 'run:status', (draft) => {
      draft.status = 'running';
      return { status: draft.status };
    });
    logTiming('ws_status_running_emitted');

    run.traceSteps = [this.#genericThinkingStep()];
    await this.#commitWorkTrace(run, 'running');

    const traceSink: TraceSink = {
      observe: (observation) => this.#observe(run, observation),
    };

    // 1. Check speculative cache for instant transition HIT
    const promptText = messages.map((m) => m.content).join(' ');
    const refMatch = promptText.match(/MDS-DEMO-[A-Z]+-\d+|OP-\d+-[A-Z0-9]+|PO-\d+-\d+/i);
    const targetStateMatch = promptText.match(/\b(in_transit|arrived_at_port|customs|delivered)\b/i);

    if (refMatch && targetStateMatch) {
      const opRef = refMatch[0].toUpperCase();
      const targetState = targetStateMatch[0].toUpperCase();
      const speculative = this.#speculativeEngine.consumeSpeculativeSpec(
        opRef,
        targetState,
        run.snapshot.facts,
      );

      if (speculative.hit && speculative.spec) {
        try {
          logTiming(`speculative_hit_saved_${speculative.savedMs}ms`);
          const ui = validateTracerSpec(speculative.spec);
          run.traceSteps = [this.#preparedUpdateStep()];
          const workTrace = this.#projectTrace(run, 'completed');
          const nextFacts = {
            ...run.snapshot.facts,
            ...this.#safeFacts(speculative.factPatch),
          };
          await this.#commitTerminalUi(run, {
            ui,
            workTrace,
            nextFacts,
            reason: 'speculative-hit',
          });
          logTiming('ws_ui_replace_emitted');

          await this.#commit(run, 'run:complete', (draft) => {
            draft.status = 'completed';
            return { status: draft.status };
          });
          logTiming('stream_closed');
        } catch (error) {
          logTiming('run_failed');
          await this.#failRun(run, error);
        }
        return;
      }
    }

    try {
      logTiming('step_execution_started');
      const parsedResult = stepResultSchema.safeParse(
        await this.#executeStep(messages, { traceSink }),
      );
      logTiming('step_execution_completed');

      if (!parsedResult.success) {
        throw new Error('Invalid StepResult', { cause: parsedResult.error });
      }

      const result = parsedResult.data;
      logTiming('ui_composition_started');
      const ui = validateTracerSpec(this.#composeUi(result));
      logTiming('ui_composition_completed');
      await run.commitTail;
      this.#settleRemaining(run, 'completed');
      const workTrace = this.#projectTrace(run, 'completed');

      await this.#commitTerminalUi(run, {
        ui,
        workTrace,
        nextFacts: {
          ...run.snapshot.facts,
          ...this.#safeFacts(result.factPatch),
        },
        reason: 'step-complete',
      });
      logTiming('ws_ui_replace_emitted');

      await this.#commit(run, 'run:complete', (draft) => {
        draft.status = 'completed';
        return { status: draft.status, findings: result.findings };
      });
      logTiming('stream_closed');

      // 2. Trigger background speculative pre-generation for next probable state
      setImmediate(() => {
        void this.#speculativeEngine.pregenerateNextState(runId, result);
      });
    } catch (error) {
      logTiming('run_failed');
      await run.commitTail;
      await this.#failRun(run, error);
    }
  }

  #getMutableRun(runId: string): CoordinatorRun {
    const run = this.#runs.get(runId);

    if (!run) {
      throw new Error(`Unknown run: ${runId}`);
    }

    return run;
  }

  #observe(run: CoordinatorRun, observation: TraceObservation): void {
    let frozen: TraceObservation;
    try {
      frozen = this.#captureObservation(observation);
    } catch {
      console.warn('[work-trace] uncloneable observation was discarded');
      return;
    }
    void this.#commitWorkTrace(run, 'running', () => {
      if (frozen.type === 'started') {
        if (run.correlations.has(frozen.correlation)) return;
        const generic = run.traceSteps[0];
        if (generic?.kind === 'thinking' && generic.status === 'running') {
          generic.status = 'completed';
          generic.detail = 'Request prepared. Continuing the logistics review.';
        }
        if (run.traceSteps.length >= 32) return;
        const stepNumber = run.traceSteps.length + 1;
        const mapped = mapToolToTraceStart(
          frozen.toolName,
          this.#recordInput(frozen.input),
          stepNumber,
        );
        run.correlations.set(frozen.correlation, run.traceSteps.length);
        run.traceSteps.push(mapped);
        return;
      }

      const index = run.correlations.get(frozen.correlation);
      if (index === undefined) return;
      const current = run.traceSteps[index];
      if (!current || current.status !== 'running') return;
      const mapped = mapToolToTraceStep(
        current.toolName ?? '',
        this.#recordInput(current.input),
        frozen.output,
        current.stepNumber,
      );
      run.traceSteps[index] = {
        ...mapped,
        status: frozen.outcome,
        ...(frozen.outcome === 'failed'
          ? {
              title: 'Logistics review incomplete',
              detail: 'The logistics review could not be completed.',
              outputSummary: undefined,
            }
          : {}),
        ...(frozen.outcome === 'completed'
          ? {
              sources: extractWorkTraceSources(
                current.toolName ?? '',
                frozen.output,
              ),
            }
          : {}),
        input: {
          input: current.input,
          ...(frozen.output === undefined ? {} : { output: frozen.output }),
        },
      };
    });
  }

  #captureObservation(observation: TraceObservation): TraceObservation {
    if (observation.type === 'started') {
      return {
        ...observation,
        input: structuredClone(observation.input),
      };
    }
    return {
      ...observation,
      ...(observation.output === undefined
        ? {}
        : { output: structuredClone(observation.output) }),
    };
  }

  #genericThinkingStep(): ExecutionTraceStep {
    return {
      id: 'internal-thinking',
      stepNumber: 1,
      kind: 'thinking',
      status: 'running',
      animationType: 'thinking',
      title: 'Reviewing your request',
      detail: 'Preparing the next logistics step.',
      durationMs: 0,
      timestamp: this.#now().toISOString(),
    };
  }

  #preparedUpdateStep(): ExecutionTraceStep {
    return {
      id: 'internal-prepared-update',
      stepNumber: 1,
      kind: 'thinking',
      status: 'completed',
      animationType: 'thinking',
      title: 'Applying prepared shipment update',
      detail: 'Applying the prepared shipment update for this request.',
      durationMs: 0,
      timestamp: this.#now().toISOString(),
    };
  }

  #settleRemaining(
    run: CoordinatorRun,
    status: 'completed' | 'failed',
  ): void {
    for (const step of run.traceSteps) {
      if (step.status !== 'running') continue;
      step.status = status;
      step.detail =
        status === 'completed'
          ? 'Logistics review completed.'
          : 'The logistics review could not be completed.';
    }
  }

  #projectTrace(
    run: CoordinatorRun,
    status: WorkTrace['status'],
  ): WorkTrace {
    return createWorkTrace({
      status,
      durationMs: Math.max(0, this.#clock() - (run.startedAt ?? this.#clock())),
      executionSteps: run.traceSteps,
    });
  }

  #commitWorkTrace(
    run: CoordinatorRun,
    status: WorkTrace['status'],
    mutate?: () => void,
  ): Promise<boolean> {
    return this.#commit(run, 'work-trace:replace', (draft) => {
      mutate?.();
      const workTrace = this.#projectTrace(run, status);
      draft.workTrace = workTrace;
      return {
        workTrace,
        responseMessageId: draft.responseMessageId,
      };
    });
  }

  async #commitTerminalUi(
    run: CoordinatorRun,
    projection: {
      ui: TracerSpec;
      workTrace: WorkTrace;
      nextFacts: Record<string, unknown>;
      reason: 'step-complete' | 'speculative-hit';
    },
  ): Promise<void> {
    const existingTargetMessageId =
      this.#locationTracker.findTargetMessageForProjection(
        projection.ui,
        run.projectionScope,
      );
    const uiTargetMessageId =
      existingTargetMessageId ?? run.snapshot.responseMessageId;
    const commitProjection = () =>
      this.#commit(
        run,
        'ui:replace',
        (draft) => {
          draft.facts = projection.nextFacts;
          draft.ui = projection.ui;
          draft.workTrace = projection.workTrace;
          draft.uiTargetMessageId = uiTargetMessageId;
          return {
            uiVersion: 1,
            reason: projection.reason,
            spec: projection.ui,
            workTrace: projection.workTrace,
            responseMessageId: draft.responseMessageId,
            uiTargetMessageId,
          };
        },
        () => {
          this.#locationTracker.registerMessageProjection(
            uiTargetMessageId,
            run.snapshot.runId,
            projection.ui,
            run.projectionScope,
          );
        },
      );

    const committed = await commitProjection();
    if (!committed) {
      const retryCommitted = await commitProjection();
      if (!retryCommitted) {
        throw new Error('Terminal UI projection could not be committed');
      }
    }

    if (existingTargetMessageId) {
      console.log(`[in-place-update] runId=${run.snapshot.runId} targetMessageId=${existingTargetMessageId} updating components in existing bubble`);
    }
  }

  async #failRun(run: CoordinatorRun, _error: unknown): Promise<void> {
    this.#settleRemaining(run, 'failed');
    const workTrace = this.#projectTrace(run, 'failed');
    const commitFailure = () =>
      this.#commit(run, 'run:complete', (draft) => {
        draft.status = 'failed';
        draft.error = 'I could not complete this logistics review.';
        draft.workTrace = workTrace;
        delete draft.uiTargetMessageId;
        return {
          status: draft.status,
          error: draft.error,
          responseMessageId: draft.responseMessageId,
          workTrace,
        };
      });
    if (!(await commitFailure())) {
      await commitFailure();
    }
  }

  #safeFacts(factPatch: Record<string, unknown> | undefined) {
    if (!factPatch) return {};
    const { executionSteps: _executionSteps, ...facts } = factPatch;
    return facts;
  }

  #recordInput(input: unknown): Record<string, unknown> {
    return input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  }

  #commit(
    run: CoordinatorRun,
    type: UIEnvelope['type'],
    prepare: (draft: RunSnapshot) => Record<string, unknown>,
    commitSideEffect?: () => void,
  ): Promise<boolean> {
    const task = run.commitTail.then(async () => {
      const draft = structuredClone(run.snapshot);
      const payload = prepare(draft);
      draft.sequence = run.snapshot.sequence + 1;
      const envelope = this.#freeze({
        runId: draft.runId,
        sequence: draft.sequence,
        type,
        timestamp: this.#now().toISOString(),
        payload: structuredClone(payload),
      });
      await this.#emit(envelope);
      commitSideEffect?.();
      run.snapshot = draft;
      return true;
    });
    const result = task.catch(() => {
      console.warn(`[work-trace] ${type} commit was discarded`);
      return false;
    });
    run.commitTail = result.then(() => undefined);
    return result;
  }

  #freeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const nested of Object.values(value)) this.#freeze(nested);
    }
    return value;
  }
}
