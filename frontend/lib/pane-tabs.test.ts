import assert from 'node:assert/strict'
import test from 'node:test'

import {
  closePaneTabState,
  keyboardPaneTabTarget,
} from './pane-tabs.js'

const ids = ['alpha', 'bravo', 'charlie']

test('browser-tab keyboard navigation wraps and supports Home and End', () => {
  assert.equal(keyboardPaneTabTarget(ids, 'alpha', 'ArrowLeft'), 'charlie')
  assert.equal(keyboardPaneTabTarget(ids, 'charlie', 'ArrowRight'), 'alpha')
  assert.equal(keyboardPaneTabTarget(ids, 'bravo', 'Home'), 'alpha')
  assert.equal(keyboardPaneTabTarget(ids, 'bravo', 'End'), 'charlie')
  assert.equal(keyboardPaneTabTarget(ids, 'bravo', 'Enter'), null)
});

test('closing the active browser tab selects the nearest remaining neighbor', () => {
  assert.deepEqual(closePaneTabState(ids, 'alpha', 'alpha'), {
    remainingIds: ['bravo', 'charlie'],
    selectedId: 'bravo',
  })
  assert.deepEqual(closePaneTabState(ids, 'bravo', 'bravo'), {
    remainingIds: ['alpha', 'charlie'],
    selectedId: 'charlie',
  })
  assert.deepEqual(closePaneTabState(ids, 'charlie', 'charlie'), {
    remainingIds: ['alpha', 'bravo'],
    selectedId: 'bravo',
  })
});

test('closing an inactive tab preserves the selected tab', () => {
  assert.deepEqual(closePaneTabState(ids, 'alpha', 'charlie'), {
    remainingIds: ['alpha', 'bravo'],
    selectedId: 'alpha',
  })
});
