import {
  workTraceSchema,
  type WorkTrace,
} from '../../backend/src/contracts/work-trace'

export {
  workTraceSchema,
  workTraceStepSchema,
} from '../../backend/src/contracts/work-trace'
export type {
  WorkTrace,
  WorkTraceSource,
  WorkTraceStep,
} from '../../backend/src/contracts/work-trace'

export function parseWorkTrace(value: unknown): WorkTrace | undefined {
  const parsed = workTraceSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}
