import { z } from 'zod';

export const executionStepKindSchema = z.enum([
  'thinking',
  'reading_document',
  'drawing_chart',
  'locating_map',
  'finding_container',
  'calculating_eta',
  'comparing_data',
  'querying_database',
  'requesting_decision',
  'generating_ui',
]);

export const thinkingAnimationTypeSchema = z.enum([
  'thinking',
  'reading',
  'drawing',
  'mapping',
  'finding',
  'findingBoat',
  'eta',
  'comparing',
]);

export type ThinkingAnimationType = z.infer<
  typeof thinkingAnimationTypeSchema
>;

export const executionTraceStepSchema = z.object({
  id: z.string(),
  stepNumber: z.number(),
  kind: executionStepKindSchema,
  animationType: thinkingAnimationTypeSchema.default('thinking'),
  title: z.string(),
  detail: z.string(),
  toolName: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  outputSummary: z.string().optional(),
  durationMs: z.number().default(0),
  timestamp: z.string(),
});

export type ExecutionTraceStep = z.infer<typeof executionTraceStepSchema>;

const redactionMarker = '\uE000work-trace-redacted\uE001';
const redactionLabel = 'la información solicitada';

function collectUntrustedScalars(
  value: unknown,
  scalars: Set<string>,
  visited: WeakSet<object>,
): void {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    const scalar = String(value).trim();
    if (scalar) scalars.add(scalar);
    return;
  }

  if (!value || typeof value !== 'object' || visited.has(value)) return;
  visited.add(value);

  for (const nested of Array.isArray(value) ? value : Object.values(value)) {
    collectUntrustedScalars(nested, scalars, visited);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizePublicText(
  text: string,
  internalInput: Record<string, unknown> | undefined,
): string {
  if (!internalInput) return text;

  const scalars = new Set<string>();
  collectUntrustedScalars(internalInput, scalars, new WeakSet());
  const unsafeValues = [...scalars].sort(
    (left, right) => right.length - left.length,
  );
  let sanitized = text;

  for (const unsafeValue of unsafeValues) {
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}_])(${escapeRegExp(unsafeValue)})(?=$|[^\\p{L}\\p{N}_])`,
      'giu',
    );
    sanitized = sanitized.replace(
      pattern,
      (_match, prefix: string) => `${prefix}${redactionMarker}`,
    );
  }

  return sanitized.split(redactionMarker).join(redactionLabel);
}

export const workTraceStepSchema = executionTraceStepSchema
  .pick({
    id: true,
    stepNumber: true,
    kind: true,
    title: true,
    detail: true,
  })
  .strict();

export const workTraceSchema = z
  .object({
    durationMs: z.number().int().nonnegative(),
    steps: z.array(workTraceStepSchema).min(1),
  })
  .strict();

export type WorkTraceStep = z.infer<typeof workTraceStepSchema>;
export type WorkTrace = z.infer<typeof workTraceSchema>;

export function createWorkTrace(input: {
  durationMs: number;
  executionSteps: unknown;
}): WorkTrace {
  const executionSteps = z
    .array(executionTraceStepSchema)
    .min(1)
    .parse(input.executionSteps);
  const needsSorting = executionSteps.some(
    (step, index) =>
      index > 0 && step.stepNumber < executionSteps[index - 1].stepNumber,
  );
  const orderedSteps = needsSorting
    ? [...executionSteps].sort((left, right) => left.stepNumber - right.stepNumber)
    : executionSteps;

  return workTraceSchema.parse({
    durationMs: Math.max(0, Math.round(input.durationMs)),
    steps: orderedSteps.map(({ id, stepNumber, kind, title, detail, input }) => ({
      id,
      stepNumber,
      kind,
      title: sanitizePublicText(title, input),
      detail: sanitizePublicText(detail, input),
    })),
  });
}
