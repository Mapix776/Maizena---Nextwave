import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createDisclosureState,
  reduceDisclosureState,
  selectAnimatedStepId,
} from './work-trace-disclosure.js'

test('live disclosure opens once, respects manual close, and collapses once at terminal', () => {
  let state = createDisclosureState('running')
  assert.equal(state.open, true)

  state = reduceDisclosureState(state, { type: 'manual-toggle' })
  assert.deepEqual(state, {
    open: false,
    manuallyClosedLive: true,
    terminalCollapsed: false,
  })
  state = reduceDisclosureState(state, { type: 'trace-status', status: 'running' })
  assert.equal(state.open, false)
  state = reduceDisclosureState(state, { type: 'manual-toggle' })
  assert.equal(state.open, true)
  state = reduceDisclosureState(state, { type: 'trace-status', status: 'completed' })
  assert.equal(state.open, false)
  assert.equal(state.terminalCollapsed, true)
  state = reduceDisclosureState(state, { type: 'manual-toggle' })
  assert.equal(state.open, true)
  state = reduceDisclosureState(state, { type: 'trace-status', status: 'completed' })
  assert.equal(state.open, true)
})

test('only the latest running step is selected for decorative animation', () => {
  assert.equal(
    selectAnimatedStepId([
      { id: 'trace-step-1', stepNumber: 1, status: 'running' },
      { id: 'trace-step-2', stepNumber: 2, status: 'completed' },
      { id: 'trace-step-3', stepNumber: 3, status: 'running' },
    ]),
    'trace-step-3',
  )
})
