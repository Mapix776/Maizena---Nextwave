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

const documentIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const workTraceSourceSchema = z
  .object({
    id: z.string().regex(/^trace-source-[1-9]\d*$/).max(32),
    title: z.string().trim().min(1).max(200),
    mimeType: z.literal('application/pdf'),
    contentUrl: z
      .string()
      .max(256)
      .regex(/^\/api\/documents\/[0-9a-f-]+\/content$/i),
  })
  .strict()
  .superRefine(({ contentUrl }, context) => {
    const documentId = contentUrl.split('/')[3] ?? '';
    if (!documentIdPattern.test(documentId)) {
      context.addIssue({ code: 'custom', message: 'Invalid document content URL' });
    }
  });

export type WorkTraceSource = z.infer<typeof workTraceSourceSchema>;

export const executionTraceStepSchema = z.object({
  id: z.string(),
  stepNumber: z.number(),
  kind: executionStepKindSchema,
  status: z.enum(['running', 'completed', 'failed']).optional(),
  animationType: thinkingAnimationTypeSchema.default('thinking'),
  title: z.string(),
  detail: z.string(),
  toolName: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  outputSummary: z.string().optional(),
  durationMs: z.number().default(0),
  timestamp: z.string(),
  sources: z.array(workTraceSourceSchema).max(8).optional(),
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
    stepNumber: true,
    kind: true,
    status: true,
    animationType: true,
    title: true,
    detail: true,
  })
  .extend({
    id: z.string().regex(/^trace-step-[1-9]\d*$/).max(32),
    stepNumber: z.number().int().positive(),
    status: z.enum(['running', 'completed', 'failed']),
    title: z.string().min(1).max(120),
    detail: z.string().min(1).max(600),
    sources: z.array(workTraceSourceSchema).max(8).optional(),
  })
  .strict();

export const workTraceSchema = z
  .object({
    status: z.enum(['running', 'completed', 'failed']),
    durationMs: z.number().int().nonnegative(),
    steps: z.array(workTraceStepSchema).min(1).max(32),
  })
  .strict()
  .superRefine(({ steps }, context) => {
    const ids = new Set<string>();
    const numbers = new Set<number>();
    for (const step of steps) {
      if (ids.has(step.id) || numbers.has(step.stepNumber)) {
        context.addIssue({
          code: 'custom',
          message: 'Work trace step identity must be unique',
          path: ['steps'],
        });
        return;
      }
      ids.add(step.id);
      numbers.add(step.stepNumber);
    }
  });

export type WorkTraceStep = z.infer<typeof workTraceStepSchema>;
export type WorkTrace = z.infer<typeof workTraceSchema>;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function extractWorkTraceSources(
  toolName: string,
  output: unknown,
): WorkTraceSource[] {
  const result = record(output);
  if (!result) return [];
  const supported =
    toolName === 'readDocumentTool' || toolName === 'read-shipment-document'
      ? result.documents
      : toolName === 'getOperationDetailsTool' || toolName === 'get-operation-details'
        ? record(result.details)?.documents
        : undefined;
  if (!Array.isArray(supported)) return [];

  const seen = new Set<string>();
  const sources: WorkTraceSource[] = [];
  for (const candidate of supported) {
    const document = record(candidate);
    if (!document) continue;
    const id = typeof document.id === 'string' ? document.id : '';
    const title = typeof document.file_name === 'string' ? document.file_name.trim() : '';
    if (
      !documentIdPattern.test(id) ||
      !title ||
      title.length > 200 ||
      document.mime_type !== 'application/pdf' ||
      typeof document.storage_bucket !== 'string' ||
      !document.storage_bucket ||
      typeof document.storage_path !== 'string' ||
      !document.storage_path ||
      seen.has(id)
    ) {
      continue;
    }
    seen.add(id);
    sources.push(
      workTraceSourceSchema.parse({
        id: `trace-source-${sources.length + 1}`,
        title,
        mimeType: 'application/pdf',
        contentUrl: `/api/documents/${id}/content`,
      }),
    );
    if (sources.length === 8) break;
  }
  return sources;
}

export function createWorkTrace(traceInput: {
  status?: 'running' | 'completed' | 'failed';
  durationMs: number;
  executionSteps: unknown;
}): WorkTrace {
  const executionSteps = z
    .array(executionTraceStepSchema)
    .min(1)
    .parse(traceInput.executionSteps);
  const needsSorting = executionSteps.some(
    (step, index) =>
      index > 0 && step.stepNumber < executionSteps[index - 1].stepNumber,
  );
  const orderedSteps = needsSorting
    ? [...executionSteps].sort((left, right) => left.stepNumber - right.stepNumber)
    : executionSteps;

  return workTraceSchema.parse({
    status: traceInput.status ?? 'completed',
    durationMs: Math.max(0, Math.round(traceInput.durationMs)),
    steps: orderedSteps.map(({ stepNumber, kind, status, animationType, title, detail, sources, input: internalInput }) => ({
      id: `trace-step-${stepNumber}`,
      stepNumber,
      kind,
      status: status ?? traceInput.status ?? 'completed',
      animationType,
      title: sanitizePublicText(title, internalInput),
      detail: sanitizePublicText(detail, internalInput),
      ...(sources?.length ? { sources } : {}),
    })),
  });
}
