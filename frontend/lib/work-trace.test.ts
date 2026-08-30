import assert from 'node:assert/strict'
import test from 'node:test'

import { workTraceSchema as authoritativeWorkTraceSchema } from '../../backend/src/contracts/work-trace.js'
import { parseWorkTrace, workTraceSchema } from './work-trace.js'

const validTrace = {
  durationMs: 4_000,
  steps: [
    {
      id: 'step-1',
      stepNumber: 1,
      kind: 'thinking',
      title: 'Preparing the response',
      detail: 'Validated the request and prepared the response.',
    },
  ],
}

test('frontend validation uses the backend-authoritative Work trace schema', () => {
  assert.equal(workTraceSchema, authoritativeWorkTraceSchema)
  assert.deepEqual(parseWorkTrace(validTrace), validTrace)
})

test('frontend validation discards traces outside the strict shared contract', () => {
  assert.equal(
    parseWorkTrace({
      ...validTrace,
      toolName: 'privateToolName',
    }),
    undefined,
  )
})
