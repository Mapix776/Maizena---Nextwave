import { z } from 'zod'

import {
  validateJsonRenderSpec,
  type JsonRenderSpec,
} from './json-render/catalog'
import { workTraceSchema, type WorkTrace } from './work-trace'

export interface ChatAttachment {
  id: string
  name: string
  size: number
  type: string
  url: string
}

export interface ChatMessage {
  id: string
  renderKey?: string
  role: 'user' | 'assistant'
  text: string
  attachments?: ChatAttachment[]
  spec?: JsonRenderSpec
  workTrace?: WorkTrace
  runId?: string
}

export interface RunProjectionCursor {
  lastSequence: number
  terminal: boolean
  responseMessageId: string
}

export interface ChatState {
  messages: ChatMessage[]
  runs: Record<string, RunProjectionCursor>
  pendingStarts: Record<string, { messageId: string }>
  unboundRunEnvelopes: RunEnvelope[]
}

export interface RunSubmissionOrchestrationState {
  chatState: ChatState
  activeRunId: string | null
  pendingRequestId: string | null
}

export interface RunEnvelope {
  runId: string
  sequence: number
  type: 'run:status' | 'work-trace:replace' | 'ui:replace' | 'run:complete'
  timestamp?: string
  payload: Record<string, unknown>
}

export interface RunSnapshot {
  runId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  sequence: number
  facts?: Record<string, unknown>
  ui: JsonRenderSpec | null
  workTrace: WorkTrace | null
  responseMessageId: string
  uiTargetMessageId?: string
  error?: string
}

export interface ActiveRunBinding {
  runId: string
  responseMessageId: string
}

const activeRunBindingSchema = z
  .object({
    runId: z.string().min(1).max(128),
    responseMessageId: z.string().min(1).max(256),
  })
  .strict()

export function parseActiveRunBinding(input: unknown): ActiveRunBinding | null {
  const parsed = activeRunBindingSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

const attachmentSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(512),
    size: z.number().int().nonnegative().max(100_000_000),
    type: z.string().max(256),
    url: z.string().max(10_000),
  })
  .strict()

const storedMessageSchema = z
  .object({
    id: z.string().min(1).max(256),
    renderKey: z.string().min(1).max(256).optional(),
    role: z.enum(['user', 'assistant']),
    text: z.string().max(20_000),
    attachments: z.array(attachmentSchema).max(20).optional(),
    spec: z.unknown().optional(),
    workTrace: z.unknown().optional(),
    runId: z.string().min(1).max(128).optional(),
  })
  .strict()

const envelopeSchema = z
  .object({
    runId: z.string().min(1).max(128),
    sequence: z.number().int().nonnegative(),
    type: z.enum([
      'run:status',
      'work-trace:replace',
      'ui:replace',
      'run:complete',
    ]),
    timestamp: z.string().datetime().optional(),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict()

const snapshotSchema = z
  .object({
    runId: z.string().min(1).max(128),
    status: z.enum(['pending', 'running', 'completed', 'failed']),
    sequence: z.number().int().nonnegative(),
    facts: z.record(z.string(), z.unknown()).optional(),
    ui: z.unknown().nullable(),
    workTrace: z.unknown().nullable(),
    responseMessageId: z.string().min(1).max(256),
    uiTargetMessageId: z.string().min(1).max(256).optional(),
    error: z.string().max(2_000).optional(),
  })
  .strict()

const workTracePayloadSchema = z
  .object({
    responseMessageId: z.string().min(1).max(256),
    workTrace: workTraceSchema,
  })
  .strict()

const uiPayloadSchema = z
  .object({
    uiVersion: z.number().int().positive(),
    reason: z.string().min(1).max(128),
    spec: z.unknown(),
    workTrace: workTraceSchema,
    responseMessageId: z.string().min(1).max(256),
    uiTargetMessageId: z.string().min(1).max(256),
  })
  .strict()

const failedCompletionPayloadSchema = z
  .object({
    status: z.literal('failed'),
    error: z.string().min(1).max(2_000),
    responseMessageId: z.string().min(1).max(256),
    workTrace: workTraceSchema,
  })
  .strict()

function parseStoredMessage(input: unknown): ChatMessage {
  const parsed = storedMessageSchema.parse(input)
  const {
    spec: rawSpec,
    workTrace: rawWorkTrace,
    ...message
  } = parsed
  const spec =
    rawSpec === undefined
      ? undefined
      : validateJsonRenderSpec(rawSpec)
  const workTrace =
    rawWorkTrace === undefined
      ? undefined
      : workTraceSchema.parse(rawWorkTrace)
  return {
    ...message,
    ...(spec ? { spec } : {}),
    ...(workTrace ? { workTrace } : {}),
  }
}

export function createChatState(messages: unknown[] = []): ChatState {
  return {
    messages: z.array(z.unknown()).max(200).parse(messages).map(parseStoredMessage),
    runs: {},
    pendingStarts: {},
    unboundRunEnvelopes: [],
  }
}

const pendingTrace: WorkTrace = workTraceSchema.parse({
  status: 'running',
  durationMs: 0,
  steps: [
    {
      id: 'trace-step-1',
      stepNumber: 1,
      kind: 'thinking',
      status: 'running',
      animationType: 'thinking',
      title: 'Reviewing your request',
      detail: 'Preparing the next logistics step.',
    },
  ],
})

export function settleUnavailableRun(
  state: ChatState,
  binding: ActiveRunBinding,
): ChatState {
  const message = state.messages.find(
    ({ id, role, runId }) =>
      id === binding.responseMessageId &&
      role === 'assistant' &&
      runId === binding.runId,
  )
  if (!message) return state
  const sourceTrace = message.workTrace ?? pendingTrace
  const failedTrace = workTraceSchema.parse({
    ...sourceTrace,
    status: 'failed',
    steps: sourceTrace.steps.map((step) => ({
      ...step,
      status: step.status === 'running' ? 'failed' : step.status,
      detail:
        step.status === 'running'
          ? 'The logistics review could not be recovered.'
          : step.detail,
    })),
  })
  return {
    ...state,
    messages: state.messages.map((current) =>
      current.id === binding.responseMessageId
        ? {
            ...current,
            text: 'This logistics review is no longer available. Please try again.',
            workTrace: failedTrace,
          }
        : current,
    ),
    runs: {
      ...state.runs,
      [binding.runId]: {
        lastSequence: state.runs[binding.runId]?.lastSequence ?? 0,
        terminal: true,
        responseMessageId: binding.responseMessageId,
      },
    },
  }
}

export function restoreActiveRunBinding(
  state: ChatState,
  storedBinding: unknown,
): { state: ChatState; binding: ActiveRunBinding | null } {
  const binding = parseActiveRunBinding(storedBinding)
  if (binding) {
    const matchingShell = state.messages.some(
      ({ id, role, runId, workTrace }) =>
        id === binding.responseMessageId &&
        role === 'assistant' &&
        runId === binding.runId &&
        workTrace?.status === 'running',
    )
    if (matchingShell) {
      return {
        state: bindRunResponseShell(
          state,
          binding.runId,
          binding.responseMessageId,
        ),
        binding,
      }
    }
  }

  const runningShells = state.messages.filter(
    ({ role, runId, workTrace }) =>
      role === 'assistant' &&
      Boolean(runId) &&
      workTrace?.status === 'running',
  )
  const relevant = binding
    ? runningShells.find(
        ({ id, runId }) =>
          id === binding.responseMessageId || runId === binding.runId,
      ) ?? (runningShells.length === 1 ? runningShells[0] : undefined)
    : runningShells.length === 1
      ? runningShells[0]
      : undefined
  if (!relevant?.runId) return { state, binding: null }
  return {
    state: settleUnavailableRun(state, {
      runId: relevant.runId,
      responseMessageId: relevant.id,
    }),
    binding: null,
  }
}

export function settleSupersededRun(
  state: ChatState,
  runId: string | null,
): ChatState {
  if (!runId || state.runs[runId]?.terminal) return state
  const responseMessageId = state.runs[runId]?.responseMessageId
  if (!responseMessageId) return state
  const message = state.messages.find(({ id }) => id === responseMessageId)
  if (!message?.workTrace || message.workTrace.status !== 'running') return state
  const failedTrace = workTraceSchema.parse({
    ...message.workTrace,
    status: 'failed',
    steps: message.workTrace.steps.map((step) => ({
      ...step,
      status: step.status === 'running' ? 'failed' : step.status,
      detail:
        step.status === 'running'
          ? 'This logistics review was replaced by your latest decision.'
          : step.detail,
    })),
  })
  return {
    ...state,
    messages: state.messages.map((current) =>
      current.id === responseMessageId
        ? {
            ...current,
            text: 'Continué con tu decisión más reciente.',
            workTrace: failedTrace,
          }
        : current,
    ),
    runs: {
      ...state.runs,
      [runId]: { ...state.runs[runId], terminal: true },
    },
  }
}

export function beginRunSubmission(
  state: ChatState,
  input: { requestId: string; userMessage: ChatMessage },
): ChatState {
  const requestId = z.string().min(1).max(128).parse(input.requestId)
  if (Object.keys(state.pendingStarts).length > 0) return state
  const userMessage = parseStoredMessage(input.userMessage)
  const localIdentity = crypto.randomUUID()
  const messageId = `pending-response-${localIdentity}`
  const pendingShell: ChatMessage = {
    id: messageId,
    renderKey: `pending-shell-${localIdentity}`,
    role: 'assistant',
    text: '',
    workTrace: pendingTrace,
  }

  return {
    ...state,
    messages: [...state.messages, userMessage, pendingShell],
    pendingStarts: {
      ...state.pendingStarts,
      [requestId]: { messageId },
    },
  }
}

export function prepareRunSubmission(
  state: RunSubmissionOrchestrationState,
  input: { requestId: string; userMessage: ChatMessage },
): {
  accepted: boolean
  state: RunSubmissionOrchestrationState
} {
  if (
    state.pendingRequestId !== null ||
    Object.keys(state.chatState.pendingStarts).length > 0
  ) {
    return { accepted: false, state }
  }
  const chatState = beginRunSubmission(state.chatState, input)
  if (chatState === state.chatState) return { accepted: false, state }
  return {
    accepted: true,
    state: {
      chatState,
      activeRunId: null,
      pendingRequestId: input.requestId,
    },
  }
}

export function bindRunStartAcknowledgement(
  state: ChatState,
  input: {
    requestId: string
    runId: string
    responseMessageId: string
  },
): ChatState {
  const requestId = z.string().min(1).max(128).parse(input.requestId)
  const runId = z.string().min(1).max(128).parse(input.runId)
  const responseMessageId = z
    .string()
    .min(1)
    .max(256)
    .parse(input.responseMessageId)
  const existingCursor = state.runs[runId]
  if (
    existingCursor?.responseMessageId === responseMessageId &&
    state.messages.some(({ id }) => id === responseMessageId)
  ) {
    return state
  }
  const pending = state.pendingStarts[requestId]
  if (!pending) {
    return bindRunResponseShell(state, runId, responseMessageId)
  }
  const alreadyBound = state.messages.some(
    ({ id }) => id === responseMessageId,
  )
  const messages = state.messages.flatMap((message) => {
    if (message.id !== pending.messageId) return [message]
    if (alreadyBound) return []
    return [{ ...message, id: responseMessageId, runId }]
  })
  const { [requestId]: _pending, ...pendingStarts } = state.pendingStarts

  const buffered = state.unboundRunEnvelopes.filter(
    (envelope) => envelope.runId === runId,
  )
  let bound: ChatState = {
    messages,
    pendingStarts,
    unboundRunEnvelopes: [],
    runs: {
      ...state.runs,
      [runId]: {
        lastSequence: 0,
        terminal: false,
        responseMessageId,
      },
    },
  }
  for (const envelope of buffered) {
    bound = applyRunProjection(bound, envelope)
  }
  return bound
}

export function failPendingRunStart(
  state: ChatState,
  requestId: string,
): ChatState {
  const pending = state.pendingStarts[requestId]
  if (!pending) return state
  const { [requestId]: _pending, ...pendingStarts } = state.pendingStarts
  const unboundRunEnvelopes =
    Object.keys(pendingStarts).length === 0 ? [] : state.unboundRunEnvelopes
  return {
    ...state,
    messages: state.messages.filter(({ id }) => id !== pending.messageId),
    pendingStarts,
    unboundRunEnvelopes,
  }
}

export function bindRunResponseShell(
  state: ChatState,
  runId: string,
  responseMessageId: string,
): ChatState {
  const existing = state.messages.find(({ id }) => id === responseMessageId)
  const messages = existing
    ? state.messages
    : [
        ...state.messages,
        {
          id: responseMessageId,
          role: 'assistant' as const,
          text: '',
          runId,
        },
      ]
  return {
    messages,
    pendingStarts: state.pendingStarts,
    unboundRunEnvelopes: state.unboundRunEnvelopes,
    runs: {
      ...state.runs,
      [runId]: state.runs[runId] ?? {
        lastSequence: 0,
        terminal: false,
        responseMessageId,
      },
    },
  }
}

function responseText(spec: JsonRenderSpec): string {
  const root = spec.elements[spec.root]
  const props = root?.props as Record<string, unknown> | undefined
  return root?.type === 'AssistantMessage' && typeof props?.text === 'string'
    ? props.text.slice(0, 20_000)
    : ''
}

function mergeSpecs(
  previous: JsonRenderSpec | undefined,
  incoming: JsonRenderSpec,
  preservePreviousRoot = false,
): JsonRenderSpec {
  if (!previous) return incoming
  if (preservePreviousRoot) {
    const patchElements = Object.fromEntries(
      Object.entries(incoming.elements).filter(
        ([elementId]) => elementId !== incoming.root,
      ),
    )
    return validateJsonRenderSpec({
      ...previous,
      elements: { ...previous.elements, ...patchElements },
    })
  }
  return validateJsonRenderSpec({
    ...previous,
    ...incoming,
    elements: { ...previous.elements, ...incoming.elements },
  })
}

function applyTrace(
  messages: ChatMessage[],
  runId: string,
  responseMessageId: string,
  workTrace: WorkTrace,
): ChatMessage[] {
  const index = messages.findIndex(({ id }) => id === responseMessageId)
  if (index < 0) {
    return [
      ...messages,
      {
        id: responseMessageId,
        role: 'assistant',
        text: '',
        runId,
        workTrace,
      },
    ]
  }
  if (messages[index].role !== 'assistant') return messages
  return messages.map((message, messageIndex) =>
    messageIndex === index
      ? { ...message, runId, workTrace }
      : message,
  )
}

function applyUi(
  messages: ChatMessage[],
  runId: string,
  responseMessageId: string,
  uiTargetMessageId: string,
  spec: JsonRenderSpec,
  workTrace: WorkTrace,
): ChatMessage[] {
  let next = applyTrace(
    messages,
    runId,
    responseMessageId,
    workTrace,
  ).map((message) =>
    message.id === responseMessageId && message.role === 'assistant'
      ? { ...message, text: responseText(spec) }
      : message,
  )
  const targetIndex = next.findIndex(
    (message) =>
      message.id === uiTargetMessageId && message.role === 'assistant',
  )
  if (targetIndex < 0) return next
  next = next.map((message, index) =>
    index === targetIndex
      ? {
          ...message,
          ...(uiTargetMessageId !== responseMessageId && !message.spec
            ? {}
            : {
                spec: mergeSpecs(
                  message.spec,
                  spec,
                  uiTargetMessageId !== responseMessageId,
                ),
              }),
        }
      : message,
  )
  return next
}

export function applyRunProjection(
  state: ChatState,
  input: RunEnvelope | RunSnapshot,
): ChatState {
  const isEnvelope = 'type' in input
  const parsed = isEnvelope
    ? envelopeSchema.safeParse(input)
    : snapshotSchema.safeParse(input)
  if (!parsed.success) return state
  const projection = parsed.data
  const cursor = state.runs[projection.runId]
  const responseMessageId = isEnvelope
    ? cursor?.responseMessageId
    : (projection as z.infer<typeof snapshotSchema>).responseMessageId
  if (!responseMessageId) {
    if (!isEnvelope || Object.keys(state.pendingStarts).length === 0) {
      return state
    }
    const envelope = projection as RunEnvelope
    return {
      ...state,
      unboundRunEnvelopes: [...state.unboundRunEnvelopes, envelope].slice(-64),
    }
  }
  if (cursor && projection.sequence <= cursor.lastSequence) return state

  const incomingTerminal = isEnvelope
    ? (projection as z.infer<typeof envelopeSchema>).type === 'run:complete'
    : ['completed', 'failed'].includes(
        (projection as z.infer<typeof snapshotSchema>).status,
      )
  if (cursor?.terminal && !incomingTerminal) return state

  let messages = state.messages
  if (isEnvelope) {
    const envelope = projection as z.infer<typeof envelopeSchema>
    if (envelope.type === 'work-trace:replace') {
      const payload = workTracePayloadSchema.safeParse(envelope.payload)
      if (!payload.success || payload.data.responseMessageId !== responseMessageId) {
        return state
      }
      messages = applyTrace(
        messages,
        envelope.runId,
        responseMessageId,
        payload.data.workTrace,
      )
    } else if (envelope.type === 'ui:replace') {
      const payload = uiPayloadSchema.safeParse(envelope.payload)
      if (!payload.success || payload.data.responseMessageId !== responseMessageId) {
        return state
      }
      let spec: JsonRenderSpec
      try {
        spec = validateJsonRenderSpec(payload.data.spec)
      } catch {
        return state
      }
      messages = applyUi(
        messages,
        envelope.runId,
        responseMessageId,
        payload.data.uiTargetMessageId,
        spec,
        payload.data.workTrace,
      )
    } else if (envelope.type === 'run:complete') {
      const failed = failedCompletionPayloadSchema.safeParse(envelope.payload)
      if (failed.success) {
        if (failed.data.responseMessageId !== responseMessageId) return state
        messages = applyTrace(
          messages,
          envelope.runId,
          responseMessageId,
          failed.data.workTrace,
        ).map((message) =>
          message.id === responseMessageId && message.role === 'assistant'
            ? { ...message, text: failed.data.error }
            : message,
        )
      }
    }
  } else {
    const snapshot = projection as z.infer<typeof snapshotSchema>
    if (snapshot.workTrace) {
      const workTrace = workTraceSchema.safeParse(snapshot.workTrace)
      if (!workTrace.success) return state
      if (snapshot.ui) {
        let spec: JsonRenderSpec
        try {
          spec = validateJsonRenderSpec(snapshot.ui)
        } catch {
          return state
        }
        messages = applyUi(
          messages,
          snapshot.runId,
          responseMessageId,
          snapshot.uiTargetMessageId ?? responseMessageId,
          spec,
          workTrace.data,
        )
      } else {
        messages = applyTrace(
          messages,
          snapshot.runId,
          responseMessageId,
          workTrace.data,
        )
      }
      if (snapshot.status === 'failed' && snapshot.error) {
        messages = messages.map((message) =>
          message.id === responseMessageId && message.role === 'assistant'
            ? { ...message, text: snapshot.error ?? 'I could not complete this logistics review.' }
            : message,
        )
      }
    }
  }

  return {
    messages,
    pendingStarts: state.pendingStarts,
    unboundRunEnvelopes: state.unboundRunEnvelopes,
    runs: {
      ...state.runs,
      [projection.runId]: {
        lastSequence: projection.sequence,
        terminal: cursor?.terminal || incomingTerminal,
        responseMessageId,
      },
    },
  }
}

export function applyIncomingRunEnvelope(
  state: ChatState,
  activeRunId: string | null,
  envelope: RunEnvelope,
): ChatState {
  if (activeRunId && envelope.runId !== activeRunId) return state
  if (!activeRunId && Object.keys(state.pendingStarts).length === 0) return state
  return applyRunProjection(state, envelope)
}
