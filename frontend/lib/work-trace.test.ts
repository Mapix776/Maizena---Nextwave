import assert from 'node:assert/strict'
import test from 'node:test'

import { workTraceSchema as authoritativeWorkTraceSchema } from '../../backend/src/contracts/work-trace.js'
import { parseWorkTrace, workTraceSchema } from './work-trace.js'

const validTrace = {
  status: 'completed',
  durationMs: 4_000,
  steps: [
    {
      id: 'trace-step-1',
      stepNumber: 1,
      kind: 'thinking',
      status: 'completed',
      animationType: 'thinking',
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

test('frontend validation accepts safe sources and rejects malformed source URLs and storage fields', () => {
  const source = {
    id: 'trace-source-1',
    title: 'Bill of Lading.pdf',
    mimeType: 'application/pdf',
    contentUrl: '/api/documents/11111111-1111-4111-8111-111111111111/content',
  }
  assert.ok(parseWorkTrace({
    ...validTrace,
    steps: [{ ...validTrace.steps[0], sources: [source] }],
  }))
  assert.equal(parseWorkTrace({
    ...validTrace,
    steps: [{ ...validTrace.steps[0], sources: [{ ...source, contentUrl: 'https://example.com/raw.pdf' }] }],
  }), undefined)
  assert.equal(parseWorkTrace({
    ...validTrace,
    steps: [{ ...validTrace.steps[0], sources: [{ ...source, storage_bucket: 'private' }] }],
  }), undefined)
})
