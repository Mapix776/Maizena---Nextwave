import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyIncomingRunEnvelope,
  applyRunProjection,
  beginRunSubmission,
  bindRunResponseShell,
  bindRunStartAcknowledgement,
  createChatState,
  failPendingRunStart,
  prepareRunSubmission,
  parseActiveRunBinding,
  restoreActiveRunBinding,
  settleUnavailableRun,
  settleSupersededRun,
} from './run-projection.js'
import {
  createDisclosureState,
  reduceDisclosureState,
  selectAnimatedStepId,
} from './work-trace-disclosure.js'

const runningTrace = {
  status: 'running' as const,
  durationMs: 25,
  steps: [
    {
      id: 'trace-step-1',
      stepNumber: 1,
      kind: 'thinking' as const,
      status: 'running' as const,
      animationType: 'thinking' as const,
      title: 'Preparando respuesta',
      detail: 'Organizando la solicitud.',
    },
  ],
}

test('submission creates one immediate running shell and acknowledgement rekeys it without duplication', () => {
  const userMessage = {
    id: 'user-local-1',
    role: 'user' as const,
    text: 'Track this shipment.',
  }
  let state = beginRunSubmission(createChatState(), {
    requestId: 'request-local-1',
    userMessage,
  })

  assert.equal(state.messages.length, 2)
  assert.deepEqual(state.messages[0], userMessage)
  const pendingShell = state.messages[1]
  assert.equal(pendingShell.role, 'assistant')
  assert.equal(pendingShell.workTrace?.status, 'running')
  assert.equal(pendingShell.text, '')
  assert.equal(
    state.messages.filter(
      ({ role, workTrace }) => role === 'assistant' && workTrace?.status === 'running',
    ).length,
    1,
  )

  state = bindRunStartAcknowledgement(state, {
    requestId: 'request-local-1',
    runId: 'run-authorized-1',
    responseMessageId: 'assistant-run-authorized-1',
  })
  assert.equal(state.messages.length, 2)
  const boundShell = state.messages[1]
  assert.equal(boundShell.id, 'assistant-run-authorized-1')
  assert.equal(boundShell.renderKey, pendingShell.renderKey)
  assert.equal(boundShell.workTrace?.status, 'running')
  assert.equal(state.runs['run-authorized-1'].responseMessageId, boundShell.id)

  const afterDuplicateAck = bindRunStartAcknowledgement(state, {
    requestId: 'request-local-1',
    runId: 'run-authorized-1',
    responseMessageId: 'assistant-run-authorized-1',
  })
  assert.equal(afterDuplicateAck.messages.length, 2)
  assert.equal(
    afterDuplicateAck.messages.filter(
      ({ id }) => id === 'assistant-run-authorized-1',
    ).length,
    1,
  )
})

test('the pure submission helper admits only one pending start and preserves its request-isolated replay', () => {
  const requestA = 'request-single-a'
  const runA = 'run-single-a'
  const responseA = 'assistant-run-single-a'
  let state = beginRunSubmission(createChatState(), {
    requestId: requestA,
    userMessage: {
      id: 'user-single-a',
      role: 'user',
      text: 'Start request A.',
    },
  })
  const pendingA = state.messages.at(-1)
  state = applyIncomingRunEnvelope(state, null, {
    runId: 'run-not-authorized-by-request-a',
    sequence: 1,
    type: 'run:status',
    payload: { status: 'running' },
  })
  state = applyIncomingRunEnvelope(state, null, {
    runId: runA,
    sequence: 1,
    type: 'work-trace:replace',
    payload: {
      responseMessageId: responseA,
      workTrace: runningTrace,
    },
  })
  for (let sequence = 2; sequence <= 64; sequence += 1) {
    state = applyIncomingRunEnvelope(state, null, {
      runId: runA,
      sequence,
      type: 'run:status',
      payload: { status: 'running' },
    })
  }
  const beforeRequestB = state

  const rejectedB = beginRunSubmission(state, {
    requestId: 'request-single-b',
    userMessage: {
      id: 'user-single-b',
      role: 'user',
      text: 'Start request B.',
    },
  })

  assert.equal(rejectedB, beforeRequestB)
  assert.deepEqual(Object.keys(rejectedB.pendingStarts), [requestA])
  assert.equal(rejectedB.messages.length, 2)
  assert.equal(rejectedB.messages.at(-1)?.renderKey, pendingA?.renderKey)
  assert.equal(rejectedB.unboundRunEnvelopes.length, 64)
  assert.equal(
    rejectedB.unboundRunEnvelopes.every(({ runId }) => runId === runA),
    true,
  )

  state = bindRunStartAcknowledgement(rejectedB, {
    requestId: requestA,
    runId: runA,
    responseMessageId: responseA,
  })
  assert.deepEqual(state.pendingStarts, {})
  assert.deepEqual(state.unboundRunEnvelopes, [])
  assert.equal(state.messages.length, 2)
  assert.equal(state.messages.at(-1)?.id, responseA)
  assert.equal(state.messages.at(-1)?.renderKey, pendingA?.renderKey)
  assert.deepEqual(state.messages.at(-1)?.workTrace, runningTrace)
  assert.equal(state.runs[runA].lastSequence, 64)
  assert.equal(state.runs['run-not-authorized-by-request-a'], undefined)

  const requestCAfterAck = beginRunSubmission(state, {
    requestId: 'request-single-c',
    userMessage: {
      id: 'user-single-c',
      role: 'user',
      text: 'Start request C.',
    },
  })
  assert.deepEqual(Object.keys(requestCAfterAck.pendingStarts), [
    'request-single-c',
  ])
  assert.equal(requestCAfterAck.messages.length, 4)

  let errorState = beginRunSubmission(createChatState(), {
    requestId: 'request-error-a',
    userMessage: {
      id: 'user-error-a',
      role: 'user',
      text: 'Start request before an explicit error.',
    },
  })
  errorState = applyIncomingRunEnvelope(errorState, null, {
    runId: 'run-error-a',
    sequence: 1,
    type: 'run:status',
    payload: { status: 'running' },
  })
  errorState = failPendingRunStart(errorState, 'request-error-a')
  assert.deepEqual(errorState.unboundRunEnvelopes, [])
  const requestAfterError = beginRunSubmission(errorState, {
    requestId: 'request-after-error',
    userMessage: {
      id: 'user-after-error',
      role: 'user',
      text: 'Start after error.',
    },
  })
  assert.deepEqual(Object.keys(requestAfterError.pendingStarts), [
    'request-after-error',
  ])
})

test('the orchestration submission seam cannot overwrite an outstanding pending request', () => {
  const initial = {
    chatState: createChatState(),
    activeRunId: 'run-valid-terminal',
    pendingRequestId: null,
  }
  const requestA = prepareRunSubmission(initial, {
    requestId: 'request-orchestration-a',
    userMessage: {
      id: 'user-orchestration-a',
      role: 'user',
      text: 'Decision A.',
    },
  })
  assert.equal(requestA.accepted, true)
  assert.equal(requestA.state.pendingRequestId, 'request-orchestration-a')
  assert.equal(requestA.state.activeRunId, null)
  assert.equal(requestA.state.chatState.messages.length, 2)

  const outstanding = {
    ...requestA.state,
    chatState: applyIncomingRunEnvelope(requestA.state.chatState, null, {
      runId: 'run-orchestration-a',
      sequence: 1,
      type: 'work-trace:replace' as const,
      payload: {
        responseMessageId: 'assistant-run-orchestration-a',
        workTrace: runningTrace,
      },
    }),
  }
  const requestB = prepareRunSubmission(outstanding, {
    requestId: 'request-orchestration-b',
    userMessage: {
      id: 'user-orchestration-b',
      role: 'user',
      text: 'Decision B.',
    },
  })
  assert.equal(requestB.accepted, false)
  assert.equal(requestB.state, outstanding)
  assert.equal(requestB.state.pendingRequestId, 'request-orchestration-a')
  assert.equal(requestB.state.activeRunId, null)
  assert.equal(requestB.state.chatState.messages.length, 2)
  assert.equal(requestB.state.chatState.unboundRunEnvelopes.length, 1)

  const acknowledgedA = {
    chatState: bindRunStartAcknowledgement(outstanding.chatState, {
      requestId: 'request-orchestration-a',
      runId: 'run-orchestration-a',
      responseMessageId: 'assistant-run-orchestration-a',
    }),
    activeRunId: 'run-orchestration-a',
    pendingRequestId: null,
  }
  const requestCAfterAck = prepareRunSubmission(acknowledgedA, {
    requestId: 'request-orchestration-c',
    userMessage: {
      id: 'user-orchestration-c',
      role: 'user',
      text: 'Decision C.',
    },
  })
  assert.equal(requestCAfterAck.accepted, true)

  const pendingError = prepareRunSubmission(initial, {
    requestId: 'request-orchestration-error',
    userMessage: {
      id: 'user-orchestration-error',
      role: 'user',
      text: 'Decision before start error.',
    },
  })
  const clearedError = {
    chatState: failPendingRunStart(
      pendingError.state.chatState,
      'request-orchestration-error',
    ),
    activeRunId: null,
    pendingRequestId: null,
  }
  assert.equal(
    prepareRunSubmission(clearedError, {
      requestId: 'request-orchestration-after-error',
      userMessage: {
        id: 'user-orchestration-after-error',
        role: 'user',
        text: 'Decision after start error.',
      },
    }).accepted,
    true,
  )
})

test('events received before a delayed start acknowledgement settle the same pending response shell', () => {
  const requestId = 'request-interleaved-1'
  const runId = 'run-interleaved-1'
  const responseMessageId = 'assistant-run-interleaved-1'
  let state = beginRunSubmission(createChatState(), {
    requestId,
    userMessage: {
      id: 'user-interleaved-1',
      role: 'user',
      text: 'Track the live operation.',
    },
  })
  const pendingShell = state.messages.at(-1)
  assert.equal(pendingShell?.workTrace?.status, 'running')

  let disclosure = createDisclosureState('running')
  disclosure = reduceDisclosureState(disclosure, { type: 'manual-toggle' })
  assert.equal(disclosure.open, false)

  const liveTrace = {
    ...runningTrace,
    durationMs: 4_500,
    steps: [
      ...runningTrace.steps.map((step) => ({
        ...step,
        status: 'completed' as const,
      })),
      {
        id: 'trace-step-2',
        stepNumber: 2,
        kind: 'querying_database' as const,
        status: 'running' as const,
        animationType: 'finding' as const,
        title: 'Consultando operaciones',
        detail: 'Buscando el estado autorizado.',
      },
    ],
  }
  const completedTrace = {
    ...liveTrace,
    status: 'completed' as const,
    durationMs: 9_059,
    steps: liveTrace.steps.map((step) => ({
      ...step,
      status: 'completed' as const,
    })),
  }
  const lifecycle = [
    {
      runId,
      sequence: 1,
      type: 'run:status' as const,
      payload: { status: 'running' },
    },
    {
      runId,
      sequence: 2,
      type: 'work-trace:replace' as const,
      payload: { responseMessageId, workTrace: liveTrace },
    },
    {
      runId,
      sequence: 3,
      type: 'ui:replace' as const,
      payload: {
        uiVersion: 1,
        reason: 'step-complete',
        responseMessageId,
        uiTargetMessageId: responseMessageId,
        workTrace: completedTrace,
        spec: {
          root: 'assistant-message',
          elements: {
            'assistant-message': {
              type: 'AssistantMessage',
              props: { text: 'Operation completed.' },
              children: ['operation-card'],
            },
            'operation-card': {
              type: 'ContainerProgress',
              props: { currentStatus: 'Delivered' },
              children: [],
            },
          },
        },
      },
    },
    {
      runId,
      sequence: 4,
      type: 'run:complete' as const,
      payload: { status: 'completed' },
    },
  ]

  state = applyIncomingRunEnvelope(state, null, {
    ...lifecycle[3],
    runId: 'run-not-authorized-by-ack',
  })

  for (const envelope of lifecycle) {
    state = applyIncomingRunEnvelope(state, null, envelope)
    if (envelope.type === 'work-trace:replace') {
      disclosure = reduceDisclosureState(disclosure, {
        type: 'trace-status',
        status: 'running',
      })
      assert.equal(disclosure.open, false)
    }
  }

  state = bindRunStartAcknowledgement(state, {
    requestId,
    runId,
    responseMessageId,
  })
  const settledShell = state.messages.find(({ id }) => id === responseMessageId)
  assert.equal(state.messages.length, 2)
  assert.equal(settledShell?.renderKey, pendingShell?.renderKey)
  assert.equal(settledShell?.text, 'Operation completed.')
  assert.equal(settledShell?.workTrace?.status, 'completed')
  assert.equal(settledShell?.workTrace?.durationMs, 9_059)
  assert.ok(settledShell?.spec?.elements['operation-card'])
  assert.equal(state.runs[runId].terminal, true)
  assert.equal(state.runs['run-not-authorized-by-ack'], undefined)
  assert.equal(selectAnimatedStepId(settledShell?.workTrace?.steps ?? []), undefined)

  disclosure = reduceDisclosureState(disclosure, {
    type: 'trace-status',
    status: 'completed',
  })
  const terminalDisclosure = disclosure
  disclosure = reduceDisclosureState(disclosure, {
    type: 'trace-status',
    status: 'completed',
  })
  assert.equal(disclosure, terminalDisclosure)
  assert.equal(disclosure.open, false)

  const afterDuplicate = applyRunProjection(state, lifecycle[2])
  const afterOlderRunning = applyRunProjection(afterDuplicate, {
    ...lifecycle[1],
    sequence: 2,
  })
  assert.equal(afterDuplicate, state)
  assert.equal(afterOlderRunning, state)
})

test('start failure removes only its pending shell and retains the submitted user message', () => {
  const state = beginRunSubmission(createChatState(), {
    requestId: 'request-failed-1',
    userMessage: {
      id: 'user-local-failed',
      role: 'user',
      text: 'Track this shipment.',
    },
  })

  const failed = failPendingRunStart(state, 'request-failed-1')
  assert.deepEqual(failed.messages, [
    {
      id: 'user-local-failed',
      role: 'user',
      text: 'Track this shipment.',
    },
  ])
  assert.deepEqual(failed.pendingStarts, {})
})

test('event and ui-null snapshot inputs share one per-run idempotent reducer', () => {
  let state = bindRunResponseShell(
    createChatState(),
    'run-a',
    'assistant-run-a',
  )
  state = applyRunProjection(state, {
    runId: 'run-a',
    sequence: 2,
    type: 'work-trace:replace',
    payload: {
      responseMessageId: 'assistant-run-a',
      workTrace: runningTrace,
    },
  })
  const afterEvent = state
  state = applyRunProjection(state, {
    runId: 'run-a',
    sequence: 2,
    status: 'running',
    facts: {},
    ui: null,
    workTrace: runningTrace,
    responseMessageId: 'assistant-run-a',
  })
  assert.equal(state, afterEvent)

  state = applyRunProjection(state, {
    runId: 'run-b',
    sequence: 4,
    status: 'running',
    facts: {},
    ui: null,
    workTrace: runningTrace,
    responseMessageId: 'assistant-run-b',
  })
  assert.equal(state.runs['run-a'].lastSequence, 2)
  assert.equal(state.runs['run-b'].lastSequence, 4)
  assert.equal(
    state.messages.find(({ id }) => id === 'assistant-run-b')?.workTrace?.status,
    'running',
  )
})

test('terminal projections update the response shell and authorized older UI target atomically', () => {
  const completedTrace = {
    ...runningTrace,
    status: 'completed' as const,
    steps: runningTrace.steps.map((step) => ({
      ...step,
      status: 'completed' as const,
    })),
  }
  let state = createChatState([
    {
      id: 'assistant-older',
      role: 'assistant',
      text: 'Older card',
      spec: {
        root: 'assistant-message',
        elements: {
          'assistant-message': {
            type: 'AssistantMessage',
            props: { text: 'Older card' },
            children: ['shared-card'],
          },
          'shared-card': {
            type: 'ContainerProgress',
            props: { currentStatus: 'Booking Confirmed' },
            children: [],
          },
        },
      },
    },
  ])
  state = bindRunResponseShell(state, 'run-a', 'assistant-run-a')
  state = applyRunProjection(state, {
    runId: 'run-a',
    sequence: 5,
    type: 'ui:replace',
    payload: {
      uiVersion: 1,
      reason: 'step-complete',
      responseMessageId: 'assistant-run-a',
      uiTargetMessageId: 'assistant-older',
      workTrace: completedTrace,
      spec: {
        root: 'assistant-message',
        elements: {
          'assistant-message': {
            type: 'AssistantMessage',
            props: { text: 'New response text' },
            children: ['shared-card'],
          },
          'shared-card': {
            type: 'ContainerProgress',
            props: { currentStatus: 'In Transit' },
            children: [],
          },
        },
      },
    },
  })
  state = applyRunProjection(state, {
    runId: 'run-a',
    sequence: 6,
    type: 'run:complete',
    payload: { status: 'completed' },
  })
  const terminal = state

  assert.equal(
    state.messages.find(({ id }) => id === 'assistant-run-a')?.text,
    'New response text',
  )
  assert.equal(
    state.messages.find(({ id }) => id === 'assistant-run-a')?.workTrace?.status,
    'completed',
  )
  const olderSpec = state.messages.find(
    ({ id }) => id === 'assistant-older',
  )?.spec
  assert.deepEqual(olderSpec?.elements['assistant-message']?.props, {
    text: 'Older card',
  })
  assert.deepEqual(olderSpec?.elements['shared-card']?.props, {
    currentStatus: 'In Transit',
  })
  assert.doesNotMatch(JSON.stringify(olderSpec), /New response text/)
  assert.equal(state.runs['run-a'].terminal, true)

  state = applyRunProjection(state, {
    runId: 'run-a',
    sequence: 7,
    type: 'work-trace:replace',
    payload: {
      responseMessageId: 'assistant-run-a',
      workTrace: runningTrace,
    },
  })
  assert.equal(state, terminal)
})

test('same-target final UI keeps the response root and intended card together', () => {
  let state = bindRunResponseShell(
    createChatState(),
    'run-same',
    'assistant-run-same',
  )
  state = applyRunProjection(state, {
    runId: 'run-same',
    sequence: 1,
    type: 'ui:replace',
    payload: {
      uiVersion: 1,
      reason: 'step-complete',
      responseMessageId: 'assistant-run-same',
      uiTargetMessageId: 'assistant-run-same',
      workTrace: { ...runningTrace, status: 'completed' },
      spec: {
        root: 'assistant-message',
        elements: {
          'assistant-message': {
            type: 'AssistantMessage',
            props: { text: 'Same target answer' },
            children: ['same-card'],
          },
          'same-card': {
            type: 'ContainerProgress',
            props: { currentStatus: 'Delivered' },
            children: [],
          },
        },
      },
    },
  })

  const message = state.messages.find(({ id }) => id === 'assistant-run-same')
  assert.equal(message?.text, 'Same target answer')
  assert.deepEqual(message?.spec?.elements['assistant-message']?.props, {
    text: 'Same target answer',
  })
  assert.deepEqual(message?.spec?.elements['same-card']?.props, {
    currentStatus: 'Delivered',
  })
})

test('card-only UI does not synthesize a natural-language Ari response', () => {
  let state = bindRunResponseShell(
    createChatState(),
    'run-card-only',
    'assistant-run-card-only',
  )
  state = applyRunProjection(state, {
    runId: 'run-card-only',
    sequence: 1,
    type: 'ui:replace',
    payload: {
      uiVersion: 1,
      reason: 'step-complete',
      responseMessageId: 'assistant-run-card-only',
      uiTargetMessageId: 'assistant-run-card-only',
      workTrace: { ...runningTrace, status: 'completed' },
      spec: {
        root: 'container-progress',
        elements: {
          'container-progress': {
            type: 'ContainerProgress',
            props: { currentStatus: 'In Transit' },
            children: [],
          },
        },
      },
    },
  })

  const message = state.messages.find(
    ({ id }) => id === 'assistant-run-card-only',
  )
  assert.equal(message?.text, '')
  assert.equal(message?.spec?.root, 'container-progress')
})

test('failed completion settles the correlated response shell without an orphan error bubble', () => {
  let state = bindRunResponseShell(
    createChatState(),
    'run-failed-shell',
    'assistant-run-failed-shell',
  )
  const failedTrace = {
    ...runningTrace,
    status: 'failed' as const,
    steps: runningTrace.steps.map((step) => ({
      ...step,
      status: 'failed' as const,
      detail: 'No fue posible completar este trabajo observable.',
    })),
  }
  state = applyRunProjection(state, {
    runId: 'run-failed-shell',
    sequence: 4,
    type: 'run:complete',
    payload: {
      status: 'failed',
      error: 'No pude completar esa respuesta.',
      responseMessageId: 'assistant-run-failed-shell',
      workTrace: failedTrace,
    },
  })

  assert.equal(state.messages.length, 1)
  assert.equal(state.messages[0].id, 'assistant-run-failed-shell')
  assert.equal(state.messages[0].text, 'No pude completar esa respuesta.')
  assert.deepEqual(state.messages[0].workTrace, failedTrace)
  assert.equal(state.runs['run-failed-shell'].terminal, true)
})

test('refresh binding validation rejoins only its correlated shell and stale loss settles visibly', () => {
  const binding = parseActiveRunBinding({
    runId: 'run-refresh-a',
    responseMessageId: 'assistant-run-refresh-a',
  })
  assert.deepEqual(binding, {
    runId: 'run-refresh-a',
    responseMessageId: 'assistant-run-refresh-a',
  })
  assert.equal(parseActiveRunBinding({ runId: 'run-refresh-a', raw: 'secret' }), null)

  let state = createChatState([
    {
      id: 'assistant-run-refresh-a',
      role: 'assistant',
      text: '',
      runId: 'run-refresh-a',
      workTrace: runningTrace,
    },
    {
      id: 'assistant-run-b',
      role: 'assistant',
      text: '',
      runId: 'run-b',
      workTrace: runningTrace,
    },
  ])
  state = settleUnavailableRun(state, binding!)

  const stale = state.messages[0]
  const independent = state.messages[1]
  assert.equal(stale.text, 'Esta ejecución ya no está disponible. Inténtalo de nuevo.')
  assert.equal(stale.workTrace?.status, 'failed')
  assert.equal(stale.workTrace?.steps.every(({ status }) => status === 'failed'), true)
  assert.equal(independent.workTrace?.status, 'running')
  assert.equal(state.runs['run-refresh-a'].terminal, true)
  assert.equal(state.runs['run-b'], undefined)
})

test('invalid persisted startup authority settles its relevant running shell and cannot rejoin', () => {
  const state = createChatState([
    {
      id: 'assistant-stale-startup',
      role: 'assistant',
      text: '',
      runId: 'run-stale-startup',
      workTrace: runningTrace,
    },
  ])

  for (const invalidBinding of [
    { runId: 'run-stale-startup', responseMessageId: 'assistant-mismatch' },
    { runId: 'run-stale-startup', raw: 'forbidden' },
  ]) {
    const recovery = restoreActiveRunBinding(state, invalidBinding)
    assert.equal(recovery.binding, null)
    assert.equal(recovery.state.messages[0].workTrace?.status, 'failed')
    assert.equal(
      recovery.state.messages[0].text,
      'Esta ejecución ya no está disponible. Inténtalo de nuevo.',
    )
    assert.equal(recovery.state.runs['run-stale-startup'].terminal, true)
  }
})

test('a superseding decision visibly resolves only the prior run and keeps cursors independent', () => {
  let state = bindRunResponseShell(createChatState(), 'run-old', 'assistant-run-old')
  state = applyRunProjection(state, {
    runId: 'run-old',
    sequence: 7,
    type: 'work-trace:replace',
    payload: { responseMessageId: 'assistant-run-old', workTrace: runningTrace },
  })
  state = settleSupersededRun(state, 'run-old')
  state = bindRunResponseShell(state, 'run-new', 'assistant-run-new')
  state = applyRunProjection(state, {
    runId: 'run-new',
    sequence: 1,
    type: 'work-trace:replace',
    payload: { responseMessageId: 'assistant-run-new', workTrace: runningTrace },
  })

  assert.equal(state.runs['run-old'].lastSequence, 7)
  assert.equal(state.runs['run-old'].terminal, true)
  assert.equal(state.runs['run-new'].lastSequence, 1)
  assert.equal(state.runs['run-new'].terminal, false)
  assert.equal(state.messages.find(({ id }) => id === 'assistant-run-old')?.workTrace?.status, 'failed')
  assert.equal(state.messages.find(({ id }) => id === 'assistant-run-new')?.workTrace?.status, 'running')
})

test('malformed stored messages and privacy fields are rejected at the projection boundary', () => {
  assert.throws(() =>
    createChatState([
      {
        id: 'assistant-run-a',
        role: 'assistant',
        text: 'Unsafe',
        workTrace: {
          ...runningTrace,
          steps: [
            {
              ...runningTrace.steps[0],
              toolName: 'privateTool',
            },
          ],
        },
      },
    ]),
  )
})
