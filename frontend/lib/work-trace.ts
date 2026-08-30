import { z } from 'zod'

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
])

export const thinkingAnimationTypeSchema = z.enum([
  'thinking',
  'reading',
  'drawing',
  'mapping',
  'finding',
  'findingBoat',
  'eta',
  'comparing',
])

export type ThinkingAnimationType = z.infer<typeof thinkingAnimationTypeSchema>

export const workTraceStepSchema = z.object({
  id: z.string().regex(/^trace-step-[1-9]\d*$/).max(32),
  stepNumber: z.number().int().positive(),
  kind: executionStepKindSchema,
  status: z.enum(['running', 'completed', 'failed']),
  animationType: thinkingAnimationTypeSchema.default('thinking'),
  title: z.string().min(1).max(120),
  detail: z.string().min(1).max(600),
}).strict()

export const workTraceSchema = z.object({
  status: z.enum(['running', 'completed', 'failed']),
  durationMs: z.number().int().nonnegative(),
  steps: z.array(workTraceStepSchema).min(1).max(32),
}).strict()

export type WorkTraceStep = z.infer<typeof workTraceStepSchema>
export type WorkTrace = z.infer<typeof workTraceSchema>

export function parseWorkTrace(value: unknown): WorkTrace | undefined {
  const parsed = workTraceSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}
