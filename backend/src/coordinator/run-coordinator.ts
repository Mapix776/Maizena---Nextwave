import { randomUUID } from 'node:crypto';

import type { ChatMessage } from '../contracts/chat.js';
import { stepResultSchema, type StepResult } from '../contracts/step-result.js';
import {
  type RunSnapshot,
  type UIEnvelope,
  validateTracerSpec,
} from '../contracts/ui.js';
import { executeAriStep } from '../mastra/ari.js';
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
  executeStep?: (messages: ChatMessage[]) => Promise<unknown>;
  composeUi?: (result: StepResult) => unknown;
  emit?: (envelope: UIEnvelope) => void | Promise<void>;
  createRunId?: () => string;
  now?: () => Date;
  speculativeEngine?: SpeculativeEngine;
  locationTracker?: ElementLocationTracker;
}

export class RunCoordinator {
  readonly #runs = new Map<string, RunSnapshot>();
  readonly #executeStep: (messages: ChatMessage[]) => Promise<unknown>;
  readonly #composeUi: (result: StepResult) => unknown;
  readonly #emit: (envelope: UIEnvelope) => void | Promise<void>;
  readonly #createRunId: () => string;
  readonly #now: () => Date;
  readonly #speculativeEngine: SpeculativeEngine;
  readonly #locationTracker: ElementLocationTracker;

  constructor(options: RunCoordinatorOptions = {}) {
    this.#executeStep = options.executeStep ?? executeAriStep;
    this.#composeUi = options.composeUi ?? composeRunUi;
    this.#emit = options.emit ?? (() => undefined);
    this.#createRunId = options.createRunId ?? randomUUID;
    this.#now = options.now ?? (() => new Date());
    this.#speculativeEngine = options.speculativeEngine ?? defaultSpeculativeEngine;
    this.#locationTracker = options.locationTracker ?? defaultElementLocationTracker;
  }

  createRun(): RunSnapshot {
    const snapshot: RunSnapshot = {
      runId: this.#createRunId(),
      status: 'pending',
      sequence: 0,
      facts: {},
      ui: null,
    };
    this.#runs.set(snapshot.runId, snapshot);
    return this.getSnapshot(snapshot.runId);
  }

  getSnapshot(runId: string): RunSnapshot {
    const run = this.#runs.get(runId);

    if (!run) {
      throw new Error(`Unknown run: ${runId}`);
    }

    return structuredClone(run);
  }

  async execute(
    runId: string,
    messages: ChatMessage[] = [
      { role: 'user', content: 'Run the json-render demo.' },
    ],
  ): Promise<void> {
    const t0 = performance.now();
    const logTiming = (evento: string) => {
      const ms = Math.round(performance.now() - t0);
      console.log(`[timing] runId=${runId} evento=${evento} ms_desde_inicio=${ms}`);
    };

    logTiming('uiIntent_received');
    const run = this.#getMutableRun(runId);
    run.status = 'running';
    await this.#emitNext(run, 'run:status', { status: run.status });
    logTiming('ws_status_running_emitted');

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
        run.facts,
      );

      if (speculative.hit && speculative.spec) {
        logTiming(`speculative_hit_saved_${speculative.savedMs}ms`);
        run.facts = { ...run.facts, ...speculative.factPatch };
        run.ui = validateTracerSpec(speculative.spec);

        const elementKeys = Object.keys((run.ui as { elements: Record<string, unknown> }).elements);
        const targetMessageId = this.#locationTracker.findTargetMessageForElements(elementKeys);
        if (targetMessageId) {
          console.log(`[in-place-update] runId=${runId} targetMessageId=${targetMessageId} updating components in existing bubble`);
        }

        const traceSteps = [
          {
            title: 'Pre-generación especulativa aplicada',
            description: `Estado ${targetState} servido instantáneamente desde caché anticipado (${speculative.savedMs}ms ahorrados).`,
            status: 'completed',
          },
        ];

        await this.#emitNext(run, 'ui:replace', {
          uiVersion: 1,
          reason: 'speculative-hit',
          spec: run.ui,
          traceSteps,
          targetMessageId,
        });
        logTiming('ws_ui_replace_emitted');

        run.status = 'completed';
        await this.#emitNext(run, 'run:complete', {
          status: run.status,
          traceSteps,
        });
        logTiming('stream_closed');
        return;
      }
    }

    try {
      logTiming('step_execution_started');
      const parsedResult = stepResultSchema.safeParse(
        await this.#executeStep(messages),
      );
      logTiming('step_execution_completed');

      if (!parsedResult.success) {
        throw new Error('Invalid StepResult', { cause: parsedResult.error });
      }

      const result = parsedResult.data;
      logTiming('ui_composition_started');
      const ui = validateTracerSpec(this.#composeUi(result));
      logTiming('ui_composition_completed');
      const traceSteps = (result.factPatch?.executionSteps as unknown[]) || [];

      run.facts = { ...run.facts, ...result.factPatch };
      run.ui = ui;

      const elementKeys = Object.keys((ui as { elements: Record<string, unknown> }).elements);
      const targetMessageId = this.#locationTracker.findTargetMessageForElements(elementKeys);
      const messageId = targetMessageId || `assistant-${runId}`;
      this.#locationTracker.registerMessageElements(messageId, runId, elementKeys);

      await this.#emitNext(run, 'ui:replace', {
        uiVersion: 1,
        reason: 'step-complete',
        spec: ui,
        traceSteps,
        targetMessageId,
      });
      logTiming('ws_ui_replace_emitted');

      run.status = 'completed';
      await this.#emitNext(run, 'run:complete', {
        status: run.status,
        traceSteps,
        findings: result.findings,
      });
      logTiming('stream_closed');

      // 2. Trigger background speculative pre-generation for next probable state
      setImmediate(() => {
        void this.#speculativeEngine.pregenerateNextState(runId, result);
      });
    } catch (error) {
      logTiming('run_failed');
      run.status = 'failed';
      run.error = error instanceof Error ? error.message : 'Run failed';
      await this.#emitNext(run, 'run:complete', {
        status: run.status,
        error: run.error,
      });
    }
  }

  #getMutableRun(runId: string): RunSnapshot {
    const run = this.#runs.get(runId);

    if (!run) {
      throw new Error(`Unknown run: ${runId}`);
    }

    return run;
  }

  async #emitNext(
    run: RunSnapshot,
    type: UIEnvelope['type'],
    payload: Record<string, unknown>,
  ): Promise<void> {
    run.sequence += 1;
    await this.#emit({
      runId: run.runId,
      sequence: run.sequence,
      type,
      timestamp: this.#now().toISOString(),
      payload,
    });
  }
}
