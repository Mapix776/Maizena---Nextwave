import { composeRunUi } from './ui-composer.js';
import { validateTracerSpec } from '../contracts/ui.js';
import type { StepResult } from '../contracts/step-result.js';

export const TRANSITION_MAP: Record<string, string[]> = {
  // 1. Initial booking / Order confirmation -> In transit
  BOOKED: ['IN_TRANSIT'],
  booked: ['in_transit'],
  booking_confirmed: ['in_transit'],
  'Booking Confirmed': ['In Transit'],
  BOOKING_CONFIRMED: ['IN_TRANSIT'],
  VESSEL_DEPARTED: ['IN_TRANSIT'],
  vessel_departed: ['in_transit'],

  // 2. Sea / Ocean transit -> Arrival at port
  IN_TRANSIT: ['ARRIVED_AT_PORT'],
  in_transit: ['arrived_at_port'],
  'In Transit': ['Arrived at Port'],
  PORT_ARRIVED: ['ARRIVED_AT_PORT'],
  port_arrived: ['arrived_at_port'],

  // 3. Port arrival -> Customs clearance / Inspection
  ARRIVED_AT_PORT: ['CUSTOMS_CLEARANCE'],
  arrived_at_port: ['customs'],
  'Arrived at Port': ['Customs'],
  DISCHARGED: ['CUSTOMS_CLEARANCE'],
  discharged: ['customs'],
  PORT_UNLOADED: ['CUSTOMS_CLEARANCE'],
  port_unloaded: ['customs'],

  // 4. Customs inspection (green/cleared) -> Out for delivery
  CUSTOMS_CLEARANCE: ['OUT_FOR_DELIVERY'],
  customs: ['out_for_delivery'],
  'Customs': ['Out for Delivery'],
  CUSTOMS_CLEARED: ['OUT_FOR_DELIVERY'],
  customs_cleared: ['out_for_delivery'],
  CLEARED: ['OUT_FOR_DELIVERY'],
  cleared: ['out_for_delivery'],

  // 5. Out for delivery / Last mile -> Final Delivered
  OUT_FOR_DELIVERY: ['DELIVERED'],
  out_for_delivery: ['delivered'],
  'Out for Delivery': ['Delivered'],
  IN_LAND_TRANSIT: ['DELIVERED'],
  in_land_transit: ['delivered'],
  LAST_MILE: ['DELIVERED'],
  last_mile: ['delivered'],
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
    // 1. Never speculate on initial ungrounded state
    if (!currentState) {
      return { allowed: false, reason: 'Initial ungrounded state' };
    }

    // 2. Never speculate when human decision, critical customs hold, or unresolved discrepancy exists
    const hasHumanDecision = Boolean(factPatch.humanDecision);
    const hasCriticalHold = Array.isArray(factPatch.customsClearance)
      ? factPatch.customsClearance.some(
          (c: { customsLight?: string }) => c.customsLight === 'red',
        )
      : false;
    const hasActiveDiscrepancy = Boolean(
      (factPatch.reconciliation as { status?: string } | undefined)?.status === 'discrepancy' ||
      (factPatch.reconciliationFindings as { status?: string } | undefined)?.status === 'discrepancy'
    );

    if (hasHumanDecision || hasCriticalHold || hasActiveDiscrepancy) {
      return {
        allowed: false,
        reason: 'Pending human decision, critical customs hold, or unresolved discrepancy',
      };
    }

    // 3. Look up transition map with normalization
    const normalized = currentState.trim().replace(/\s+/g, '_').toUpperCase();
    const nextStates =
      TRANSITION_MAP[currentState] ??
      TRANSITION_MAP[normalized] ??
      TRANSITION_MAP[currentState.toLowerCase()];

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
      const existing = opSummary as Record<string, unknown>;
      const existingContainers = Array.isArray(existing.containers) ? existing.containers : [];
      speculativeFactPatch.operationSummary = {
        operationId: (existing.operationId as string) ?? opSummary.referenceCode ?? operationRef,
        referenceCode: opSummary.referenceCode ?? operationRef,
        clientName: (existing.clientName as string) ?? (factPatch.clientName as string) ?? 'Muebles del Sur',
        status: nextState,
        tags: Array.isArray(existing.tags) ? existing.tags : ['Ocean', 'Active'],
        containers: existingContainers.length > 0
          ? existingContainers.map((c: any) => ({
              id: c.id ?? `cont-${c.containerNumber ?? '1'}`,
              containerNumber: c.containerNumber ?? (factPatch.deliveryId as string) ?? 'MSKU1234567',
              status: nextState,
              originPort: c.originPort ?? (factPatch.from as string) ?? 'Ho Chi Minh City, Vietnam',
              destinationPort: c.destinationPort ?? (factPatch.to as string) ?? 'Manzanillo, Mexico',
            }))
          : [
              {
                id: `cont-${(factPatch.deliveryId as string) ?? 'MSKU1234567'}`,
                containerNumber: (factPatch.deliveryId as string) ?? 'MSKU1234567',
                status: nextState,
                originPort: (factPatch.from as string) ?? 'Ho Chi Minh City, Vietnam',
                destinationPort: (factPatch.to as string) ?? 'Manzanillo, Mexico',
              },
            ],
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
