import assert from 'node:assert/strict'
import test from 'node:test'

import { validateJsonRenderSpec } from './catalog'

test('the frontend catalog rejects unknown components and invalid component props', () => {
  const unknownComponent = {
    root: 'unknown',
    elements: {
      unknown: { type: 'UnknownComponent', props: {}, children: [] },
    },
  }
  const invalidOperation = {
    root: 'operation',
    elements: {
      operation: {
        type: 'OperationSummaryCard',
        props: { referenceCode: 'MISSING_REQUIRED_FIELDS' },
        children: [],
      },
    },
  }

  assert.throws(() => validateJsonRenderSpec(unknownComponent), /Invalid json-render tree/)
  assert.throws(() => validateJsonRenderSpec(invalidOperation), /Invalid props/)
});
