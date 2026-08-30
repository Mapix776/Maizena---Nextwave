import { composeRunUi } from './ui-composer.js';
import { validateTracerSpec } from '../contracts/ui.js';
import type { StepResult } from '../contracts/step-result.js';

export const TRANSITION_MAP: Record<string, string[]> = {
  BOOKED: ['IN_TRANSIT'],
  booking_confirmed: ['in_transit'],
  IN_TRANSIT: ['ARRIVED_AT_PORT'],
  in_transit: ['arrived_at_port'],
  ARRIVED_AT_PORT: ['CUSTOMS_CLEARANCE'],
  arrived_at_port: ['customs'],
  CUSTOMS_CLEARANCE: ['DELIVERED'],
  customs: ['delivered'],
};

export interface SpeculativeEntry {
  key: string;
  runId: string;
  operationReference: string;
  forState: string;
  spec: unknown;
  factPatch: Record<string, unknown>;
  generatedAt: number;
  status: 'pending' | 'ready' | 'discarded';
}

export class SpeculativeEngine {
  readonly #cache = new Map<string, SpeculativeEntry>();
  readonly #ttlMs: number;

  constructor(options: { ttlMs?: number } = {}) {
    this.#ttlMs = options.ttlMs ?? 90_000; // 90 seconds
  }

  getCacheSize(): number {
    this.cleanExpired();
    return this.#cache.size;
  }

  cleanExpired(now = Date.now()): void {
    for (const [key, entry] of this.#cache.entries()) {
      if (now - entry.generatedAt > this.#ttlMs) {
        console.log(`[speculative] runId=${entry.runId} forState=${entry.forState} EXPIRED`);
        this.#cache.delete(key);
      }
    }
  }

  clear(): void {
    this.#cache.clear();
  }

  canSpeculate(
    currentState: string,
    factPatch: Record<string, unknown> = {},
  ): { allowed: boolean; nextState?: string; reason?: string } {
    // 1. Never speculate on initial booking creation without prior context
    if (!currentState) {
      return { allowed: false, reason: 'Initial ungrounded state' };
    }

    // 2. Never speculate when a human decision is pending or critical customs hold exists
    const hasHumanDecision = Boolean(factPatch.humanDecision);
    const hasCriticalHold = Array.isArray(factPatch.customsClearance)
      ? factPatch.customsClearance.some(
          (c: { customsLight?: string }) => c.customsLight === 'red',
        )
      : false;

    if (hasHumanDecision || hasCriticalHold) {
      return {
        allowed: false,
        reason: 'Pending human decision or critical customs inspection hold',
      };
    }

    // 3. Look up transition map
    const normalized = currentState.toUpperCase();
    const nextStates = TRANSITION_MAP[normalized] ?? TRANSITION_MAP[currentState];

    if (!nextStates || nextStates.length === 0) {
      return {
        allowed: false,
        reason: `No subsequent state defined for ${currentState}`,
      };
    }

    const nextState = nextStates[0];
    return { allowed: true, nextState };
  }

  async pregenerateNextState(
    runId: string,
    currentResult: StepResult,
  ): Promise<SpeculativeEntry | null> {
    const factPatch = currentResult.factPatch ?? {};
    const opSummary = factPatch.operationSummary as
      | { referenceCode?: string; status?: string }
      | undefined;
    const currentState = opSummary?.status ?? (factPatch.status as string) ?? '';
    const operationRef = opSummary?.referenceCode ?? (factPatch.deliveryId as string) ?? 'DEMO';

    const check = this.canSpeculate(currentState, factPatch);
    if (!check.allowed || !check.nextState) {
      return null;
    }

    const nextState = check.nextState;
    const cacheKey = `${operationRef}:${nextState}`;

    // Avoid duplicate parallel generations
    const existing = this.#cache.get(cacheKey);
    if (existing && existing.status === 'ready' && Date.now() - existing.generatedAt < this.#ttlMs) {
      return existing;
    }

    const t0 = performance.now();
    console.log(`[speculative] runId=${runId} forState=${nextState} iniciado`);

    // Build speculative fact patch for the anticipated state
    const speculativeFactPatch: Record<string, unknown> = {
      ...factPatch,
      assistantResponse: `Transición completada: La operación ${operationRef} ha avanzado al estado ${nextState}.`,
      status: nextState,
    };

    if (opSummary) {
      speculativeFactPatch.operationSummary = {
        ...opSummary,
        status: nextState,
      };
    }

    // Advance step progress bar milestone if present
    if (factPatch.stepProgressBar) {
      const spb = factPatch.stepProgressBar as {
        title: string;
        currentStepIndex: number;
        totalSteps: number;
        steps: Array<{ id: string; label: string; status: 'completed' | 'current' | 'pending' }>;
      };
      if (Array.isArray(spb.steps) && spb.steps.length >= 2) {
        const nextIdx = Math.min((spb.currentStepIndex ?? 0) + 1, spb.steps.length - 1);
        speculativeFactPatch.stepProgressBar = {
          ...spb,
          currentStepIndex: nextIdx,
          steps: spb.steps.map((step, idx) => ({
            ...step,
            status: idx < nextIdx ? 'completed' : idx === nextIdx ? 'current' : 'pending',
          })),
        };
      }
    }

    try {
      const speculativeStepResult: StepResult = {
        status: 'completed',
        summary: `Pre-generated state for ${nextState}`,
        factPatch: speculativeFactPatch,
        evidence: [
          ...(currentResult.evidence ?? []),
          { id: `speculative-${nextState.toLowerCase()}`, source: 'speculative:flow-engine' },
        ],
      };

      const rawSpec = composeRunUi(speculativeStepResult);
      const validatedSpec = validateTracerSpec(rawSpec);

      const entry: SpeculativeEntry = {
        key: cacheKey,
        runId,
        operationReference: operationRef,
        forState: nextState,
        spec: validatedSpec,
        factPatch: speculativeFactPatch,
        generatedAt: Date.now(),
        status: 'ready',
      };

      this.#cache.set(cacheKey, entry);
      const elapsed = Math.round(performance.now() - t0);
      console.log(`[speculative] runId=${runId} forState=${nextState} listo en ${elapsed}ms`);
      return entry;
    } catch (error) {
      console.warn(`[speculative] Pre-generation failed for ${nextState}:`, error);
      return null;
    }
  }

  consumeSpeculativeSpec(
    operationReference: string,
    targetState: string,
    currentFacts: Record<string, unknown> = {},
  ): { hit: boolean; spec?: unknown; factPatch?: Record<string, unknown>; savedMs?: number } {
    this.cleanExpired();
    const cacheKey = `${operationReference}:${targetState}`;
    const entry = this.#cache.get(cacheKey);

    if (!entry || entry.status !== 'ready') {
      return { hit: false };
    }

    // Discard if critical data in current facts differs significantly
    if (currentFacts.humanDecision || currentFacts.hasNewDiscrepancy) {
      console.log(
        `[speculative] runId=${entry.runId} forState=${targetState} DISCARDED — nueva decisión humana detectada`,
      );
      this.#cache.delete(cacheKey);
      return { hit: false };
    }

    const savedMs = 240; // Saved LLM + orchestration cycle
    console.log(
      `[speculative] runId=${entry.runId} forState=${targetState} HIT — ahorro de ${savedMs}ms`,
    );
    this.#cache.delete(cacheKey);

    return {
      hit: true,
      spec: entry.spec,
      factPatch: entry.factPatch,
      savedMs,
    };
  }
}

export const defaultSpeculativeEngine = new SpeculativeEngine();
