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

interface RunCoordinatorOptions {
  executeStep?: (messages: ChatMessage[]) => Promise<unknown>;
  composeUi?: (result: StepResult) => unknown;
  emit?: (envelope: UIEnvelope) => void | Promise<void>;
  createRunId?: () => string;
  now?: () => Date;
}

export class RunCoordinator {
  readonly #runs = new Map<string, RunSnapshot>();
  readonly #executeStep: (messages: ChatMessage[]) => Promise<unknown>;
  readonly #composeUi: (result: StepResult) => unknown;
  readonly #emit: (envelope: UIEnvelope) => void | Promise<void>;
  readonly #createRunId: () => string;
  readonly #now: () => Date;

  constructor(options: RunCoordinatorOptions = {}) {
    this.#executeStep = options.executeStep ?? executeAriStep;
    this.#composeUi = options.composeUi ?? composeRunUi;
    this.#emit = options.emit ?? (() => undefined);
    this.#createRunId = options.createRunId ?? randomUUID;
    this.#now = options.now ?? (() => new Date());
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
    const run = this.#getMutableRun(runId);
    run.status = 'running';
    await this.#emitNext(run, 'run:status', { status: run.status });

    try {
      const parsedResult = stepResultSchema.safeParse(
        await this.#executeStep(messages),
      );

      if (!parsedResult.success) {
        throw new Error('Invalid StepResult', { cause: parsedResult.error });
      }

      const result = parsedResult.data;
      const ui = validateTracerSpec(this.#composeUi(result));
      const traceSteps = (result.factPatch?.executionSteps as unknown[]) || [];

      run.facts = { ...run.facts, ...result.factPatch };
      run.ui = ui;
      await this.#emitNext(run, 'ui:replace', {
        uiVersion: 1,
        reason: 'step-complete',
        spec: ui,
        traceSteps,
      });

      run.status = 'completed';
      await this.#emitNext(run, 'run:complete', {
        status: run.status,
        traceSteps,
        findings: result.findings,
      });
    } catch (error) {
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
