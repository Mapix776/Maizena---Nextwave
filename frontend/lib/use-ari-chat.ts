'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { io, type Socket } from 'socket.io-client'

import { getTranslations, type Locale } from '@/lib/i18n'
import type { JsonRenderSpec } from '@/lib/json-render/catalog'

export type ConnectionStatus = 'connecting' | 'ready' | 'running' | 'error'
export type MessageRole = 'user' | 'assistant'

export interface ChatAttachment {
  id: string
  name: string
  size: number
  type: string
  url: string
}

export interface TraceStep {
  title: string
  detail?: string
  outputSummary?: string
  status?: 'completed' | 'in_progress' | 'failed'
}

export interface ChatMessage {
  id: string
  role: MessageRole
  text: string
  attachments?: ChatAttachment[]
  spec?: JsonRenderSpec
  traceSteps?: TraceStep[]
}

export interface RunSnapshot {
  runId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  sequence: number
  facts?: Record<string, unknown>
  ui: JsonRenderSpec | null
  error?: string
  targetMessageId?: string
  traceSteps?: TraceStep[]
}

export interface UIReplacePayload {
  uiVersion: number
  reason: string
  spec: JsonRenderSpec
  traceSteps?: TraceStep[]
  targetMessageId?: string
}

export interface RunEnvelope {
  runId: string
  sequence: number
  type: 'run:status' | 'ui:replace' | 'run:complete'
  payload: Record<string, unknown>
}

import { getBackendUrl } from './backend-url'
const CHAT_STORAGE_KEY = 'nauta_chat_messages_v1'

function loadStoredMessages(): ChatMessage[] | null {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as ChatMessage[]
    }
  } catch (error) {
    console.error('Error al leer historial local:', error)
  }
  return null
}

function responseText(spec: JsonRenderSpec): string {
  const root = spec.elements[spec.root]
  const props = root?.props as Record<string, unknown> | undefined
  return typeof props?.text === 'string'
    ? props.text
    : 'Respuesta renderizada.'
}

function messagesForRun(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.text)
    .slice(-40)
    .map(({ role, text: content }) => ({ role, content }))
}

function mergeSpecs(
  previous: JsonRenderSpec,
  incoming: JsonRenderSpec,
): JsonRenderSpec {
  return {
    ...previous,
    ...incoming,
    elements: {
      ...previous.elements,
      ...incoming.elements,
    },
  }
}

function overlappingMessageIndex(
  messages: ChatMessage[],
  spec: JsonRenderSpec,
): number {
  const incomingIds = new Set(
    Object.keys(spec.elements).filter((id) => id !== 'assistant-message'),
  )
  if (incomingIds.size === 0) return -1

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (
      message.role === 'assistant' &&
      message.spec &&
      Object.keys(message.spec.elements).some((id) => incomingIds.has(id))
    ) {
      return index
    }
  }
  return -1
}

export function useAriChat({
  dispatchBlocked = false,
  dispatchBlockedRef,
  locale,
  onNotify,
}: {
  dispatchBlocked?: boolean
  dispatchBlockedRef?: RefObject<boolean>
  locale: Locale
  onNotify: (message: string) => void
}) {
  const t = getTranslations(locale)
  const socketRef = useRef<Socket | null>(null)
  const activeRunId = useRef<string | null>(null)
  const pendingRequestId = useRef<string | null>(null)
  const latestSequence = useRef(0)
  const messagesRef = useRef<ChatMessage[]>([])
  const connectionStatusRef = useRef<ConnectionStatus>('connecting')
  const queuedDecisions = useRef<string[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('connecting')

  const updateConnectionStatus = useCallback((status: ConnectionStatus) => {
    connectionStatusRef.current = status
    setConnectionStatus(status)
  }, [])

  useEffect(() => {
    const url = getBackendUrl()
    const socket = io(url, { transports: ['websocket'] })
    socketRef.current = socket

    function applyRenderedResponse(
      runId: string,
      spec: JsonRenderSpec,
      targetMessageId?: string,
      traceSteps?: TraceStep[],
    ) {
      setMessages((current) => {
        const id = `assistant-${runId}`
        const explicitTargetIndex = targetMessageId
          ? current.findIndex(
              (message) =>
                message.id === targetMessageId && message.role === 'assistant',
            )
          : -1
        const sameRunIndex = current.findIndex((message) => message.id === id)
        const inferredTargetIndex =
          !targetMessageId && sameRunIndex < 0
            ? overlappingMessageIndex(current, spec)
            : -1
        const targetIndex =
          explicitTargetIndex >= 0
            ? explicitTargetIndex
            : sameRunIndex >= 0
              ? sameRunIndex
              : inferredTargetIndex

        let next: ChatMessage[]
        if (targetIndex >= 0) {
          const previous = current[targetIndex]
          const targetsEarlierBubble = targetIndex !== sameRunIndex
          const nextSpec =
            targetsEarlierBubble && previous.spec
              ? mergeSpecs(previous.spec, spec)
              : spec
          next = current.map((message, index) =>
            index === targetIndex
              ? {
                  ...message,
                  text: responseText(nextSpec),
                  spec: nextSpec,
                  traceSteps:
                    traceSteps && traceSteps.length > 0
                      ? traceSteps
                      : message.traceSteps,
                }
              : message,
          )
        } else {
          next = [
            ...current,
            {
              id,
              role: 'assistant',
              text: responseText(spec),
              spec,
              traceSteps,
            },
          ]
        }
        messagesRef.current = next
        return next
      })
    }

    function appendRunError(runId: string, text: string) {
      setMessages((current) => {
        const id = `error-${runId}`
        if (current.some((message) => message.id === id)) return current
        const next: ChatMessage[] = [
          ...current,
          { id, role: 'assistant', text },
        ]
        messagesRef.current = next
        return next
      })
    }

    function applySnapshot(snapshot: RunSnapshot) {
      if (
        snapshot.runId !== activeRunId.current ||
        snapshot.sequence < latestSequence.current
      ) {
        return
      }

      latestSequence.current = snapshot.sequence
      if (snapshot.ui) {
        applyRenderedResponse(
          snapshot.runId,
          snapshot.ui,
          snapshot.targetMessageId,
          snapshot.traceSteps,
        )
      }

      if (snapshot.status === 'failed') {
        appendRunError(
          snapshot.runId,
          snapshot.error ?? 'No pude completar esa respuesta.',
        )
        updateConnectionStatus('error')
      } else if (snapshot.status === 'completed') {
        updateConnectionStatus('ready')
      } else {
        updateConnectionStatus('running')
      }
    }

    socket.on('connect', () => {
      const runId = activeRunId.current
      updateConnectionStatus(runId ? 'running' : 'ready')

      if (runId) {
        socket.emit(
          'run:join',
          { runId },
          (ack: { ok: boolean; snapshot?: RunSnapshot; error?: string }) => {
            if (ack.ok && ack.snapshot) {
              applySnapshot(ack.snapshot)
            } else {
              updateConnectionStatus('error')
            }
          },
        )
      }
    })

    socket.on('connect_error', () => {
      updateConnectionStatus('error')
    })

    socket.on('run:event', (envelope: RunEnvelope) => {
      if (
        envelope.runId !== activeRunId.current ||
        envelope.sequence <= latestSequence.current
      ) {
        return
      }

      latestSequence.current = envelope.sequence

      if (envelope.type === 'run:status') {
        updateConnectionStatus('running')
      }

      if (envelope.type === 'ui:replace') {
        const payload = envelope.payload as unknown as UIReplacePayload
        applyRenderedResponse(
          envelope.runId,
          payload.spec,
          payload.targetMessageId,
          payload.traceSteps,
        )
      }

      if (envelope.type === 'run:complete') {
        if (envelope.payload.status === 'failed') {
          appendRunError(
            envelope.runId,
            String(
              envelope.payload.error ?? 'No pude completar esa respuesta.',
            ),
          )
          updateConnectionStatus('error')
        } else {
          updateConnectionStatus('ready')
        }
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [updateConnectionStatus])

  useEffect(() => {
    const stored = loadStoredMessages()
    if (!stored) return
    messagesRef.current = stored
    setMessages(stored)
  }, [])

  useEffect(() => {
    if (messages.length === 0) return
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages))
    } catch (error) {
      console.error('Error al guardar historial local:', error)
    }
  }, [messages])

  const dispatchDecision = useCallback(
    (selected: string) => {
      const socket = socketRef.current
      if (!socket?.connected) return

      // Preserve the legacy HITL contract: a decision may supersede a run that
      // is already pending or running, so this path intentionally has no
      // connectionStatus guard.

      const userMessage: ChatMessage = {
        id: `user-${crypto.randomUUID()}`,
        role: 'user',
        text: `Selected option: "${selected}". Proceed with this decision.`,
      }
      const nextMessages = [...messagesRef.current, userMessage]
      const requestId = crypto.randomUUID()

      pendingRequestId.current = requestId
      activeRunId.current = null
      latestSequence.current = 0
      messagesRef.current = nextMessages
      setMessages(nextMessages)
      updateConnectionStatus('running')

      socket.emit(
        'run:start',
        {
          requestId,
          messages: messagesForRun(nextMessages),
        },
        (ack: { ok: boolean; runId?: string; error?: string }) => {
          if (pendingRequestId.current !== requestId) return
          pendingRequestId.current = null
          if (ack.ok && ack.runId) {
            activeRunId.current = ack.runId
          }
        },
      )
    },
    [updateConnectionStatus],
  )

  useEffect(() => {
    const handleDecision = (event: Event) => {
      const customEvent = event as CustomEvent<{
        optionId: string
        payload: string
      }>
      const selected = customEvent.detail.payload || customEvent.detail.optionId
      if (!socketRef.current?.connected) return
      if (dispatchBlockedRef?.current) {
        queuedDecisions.current.push(selected)
        return
      }
      dispatchDecision(selected)
    }

    window.addEventListener('nauta:decision-selected', handleDecision)
    return () => {
      window.removeEventListener('nauta:decision-selected', handleDecision)
    }
  }, [dispatchBlockedRef, dispatchDecision])

  useEffect(() => {
    if (dispatchBlocked || dispatchBlockedRef?.current) return
    const decisions = queuedDecisions.current.splice(0)
    decisions.forEach(dispatchDecision)
  }, [dispatchBlocked, dispatchBlockedRef, dispatchDecision])

  const dispatchMessage = useCallback(
    (text: string, attachments: ChatAttachment[]): boolean => {
      const socket = socketRef.current

      if (
        (!text && attachments.length === 0) ||
        connectionStatusRef.current === 'running'
      ) {
        return false
      }
      if (!socket?.connected) {
        onNotify(`No se pudo conectar con el backend en ${backendUrl}`)
        return false
      }

      const userMessage: ChatMessage = {
        id: `user-${crypto.randomUUID()}`,
        role: 'user',
        text: text || t.attach,
        attachments: attachments.length ? attachments : undefined,
      }
      const nextMessages = [...messagesRef.current, userMessage]
      const requestId = crypto.randomUUID()

      pendingRequestId.current = requestId
      activeRunId.current = null
      latestSequence.current = 0
      messagesRef.current = nextMessages
      setMessages(nextMessages)
      updateConnectionStatus('running')

      socket.emit(
        'run:start',
        {
          requestId,
          messages: messagesForRun(nextMessages),
        },
        (ack: { ok: boolean; runId?: string; error?: string }) => {
          if (pendingRequestId.current !== requestId) return
          pendingRequestId.current = null

          if (!ack.ok || !ack.runId) {
            updateConnectionStatus('error')
            setMessages((current) => {
              const next: ChatMessage[] = [
                ...current,
                {
                  id: `error-${requestId}`,
                  role: 'assistant',
                  text: ack.error ?? 'No pude iniciar esa respuesta.',
                },
              ]
              messagesRef.current = next
              return next
            })
            return
          }

          activeRunId.current = ack.runId
        },
      )

      return true
    },
    [onNotify, t.attach],
  )

  const clearConversation = useCallback(() => {
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY)
    } catch (error) {
      console.error('Error al limpiar historial local:', error)
    }

    for (const message of messagesRef.current) {
      for (const attachment of message.attachments ?? []) {
        if (attachment.url.startsWith('blob:')) {
          URL.revokeObjectURL(attachment.url)
        }
      }
    }

    activeRunId.current = null
    pendingRequestId.current = null
    latestSequence.current = 0
    queuedDecisions.current = []
    messagesRef.current = []
    setMessages([])
    updateConnectionStatus(socketRef.current?.connected ? 'ready' : 'connecting')
  }, [updateConnectionStatus])

  return {
    clearConversation,
    connectionStatus,
    dispatchMessage,
    messages,
  }
}
