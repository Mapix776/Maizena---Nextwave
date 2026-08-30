'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { io, type Socket } from 'socket.io-client'

import { getTranslations, type Locale } from '@/lib/i18n'
import { getBackendUrl } from '@/lib/backend-url'
import {
  ARI_PROMPT_REQUESTED_EVENT,
  type AriPromptRequestedDetail,
} from '@/lib/ari-ui-events'
import {
  applyIncomingRunEnvelope,
  applyRunProjection,
  bindRunStartAcknowledgement,
  createChatState,
  failPendingRunStart,
  prepareRunSubmission,
  restoreActiveRunBinding,
  settleSupersededRun,
  settleUnavailableRun,
  type ChatAttachment,
  type ChatMessage,
  type ChatState,
  type RunEnvelope,
  type RunSnapshot,
} from '@/lib/run-projection'

export type { ChatAttachment, ChatMessage } from '@/lib/run-projection'

export type ConnectionStatus = 'connecting' | 'ready' | 'running' | 'error'
export type MessageRole = 'user' | 'assistant'

const backendUrl = getBackendUrl()
const CHAT_STORAGE_KEY = 'nauta_chat_messages_v1'
const ACTIVE_RUN_STORAGE_KEY = 'nauta_active_run_v1'

function loadStoredMessages(): ChatMessage[] | null {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return createChatState(parsed).messages
    }
  } catch (error) {
    console.error('Error al leer historial local:', error)
  }
  return null
}

function loadActiveRunBinding(): { present: boolean; value: unknown } {
  try {
    const raw = localStorage.getItem(ACTIVE_RUN_STORAGE_KEY)
    return raw === null
      ? { present: false, value: null }
      : { present: true, value: JSON.parse(raw) }
  } catch {
    return { present: true, value: null }
  }
}

function storeActiveRunBinding(binding: {
  runId: string
  responseMessageId: string
} | null) {
  try {
    if (binding) {
      localStorage.setItem(ACTIVE_RUN_STORAGE_KEY, JSON.stringify(binding))
    } else {
      localStorage.removeItem(ACTIVE_RUN_STORAGE_KEY)
    }
  } catch {
    // Recovery is best effort and never changes the live run contract.
  }
}

function messagesForRun(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.text)
    .slice(-40)
    .map(({ role, text: content }) => ({ role, content }))
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
  const messagesRef = useRef<ChatMessage[]>([])
  const projectionStateRef = useRef<ChatState>(createChatState())
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
    const stored = loadStoredMessages()
    const storedBinding = loadActiveRunBinding()
    let restored = createChatState(stored ?? [])
    if (storedBinding.present) {
      const recovery = restoreActiveRunBinding(restored, storedBinding.value)
      restored = recovery.state
      activeRunId.current = recovery.binding?.runId ?? null
      if (!recovery.binding) storeActiveRunBinding(null)
    } else {
      const unboundRunningShell = restored.messages.find(
        ({ id, role, runId, workTrace }) =>
          Boolean(id && role === 'assistant' && runId && workTrace?.status === 'running'),
      )
      if (unboundRunningShell?.runId) {
        restored = settleUnavailableRun(restored, {
          runId: unboundRunningShell.runId,
          responseMessageId: unboundRunningShell.id,
        })
      }
      storeActiveRunBinding(null)
    }
    projectionStateRef.current = restored
    messagesRef.current = restored.messages
    setMessages(restored.messages)

    const socket = io(backendUrl, { transports: ['websocket'] })
    socketRef.current = socket

    function commitProjection(input: RunEnvelope | RunSnapshot) {
      const next = applyRunProjection(projectionStateRef.current, input)
      if (next === projectionStateRef.current) return false
      projectionStateRef.current = next
      messagesRef.current = next.messages
      setMessages(next.messages)
      return true
    }

    function applySnapshot(snapshot: RunSnapshot) {
      if (
        snapshot.runId !== activeRunId.current
      ) {
        return
      }

      commitProjection(snapshot)

      if (snapshot.status === 'failed') {
        activeRunId.current = null
        storeActiveRunBinding(null)
        updateConnectionStatus('error')
      } else if (snapshot.status === 'completed') {
        activeRunId.current = null
        storeActiveRunBinding(null)
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
              const storedActiveBinding = loadActiveRunBinding()
              const activeBinding = storedActiveBinding.present
                ? restoreActiveRunBinding(
                    projectionStateRef.current,
                    storedActiveBinding.value,
                  ).binding
                : null
              if (activeBinding) {
                const next = settleUnavailableRun(
                  projectionStateRef.current,
                  activeBinding,
                )
                projectionStateRef.current = next
                messagesRef.current = next.messages
                setMessages(next.messages)
              }
              activeRunId.current = null
              storeActiveRunBinding(null)
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
      const next = applyIncomingRunEnvelope(
        projectionStateRef.current,
        activeRunId.current,
        envelope,
      )
      if (next === projectionStateRef.current) return
      projectionStateRef.current = next
      messagesRef.current = next.messages
      setMessages(next.messages)

      if (envelope.runId !== activeRunId.current) return

      if (envelope.type === 'run:status') {
        updateConnectionStatus('running')
      }

      if (envelope.type === 'run:complete') {
        activeRunId.current = null
        storeActiveRunBinding(null)
        if (envelope.payload.status === 'failed') {
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
      const requestId = crypto.randomUUID()
      const superseded = settleSupersededRun(
        projectionStateRef.current,
        activeRunId.current,
      )
      const attempt = prepareRunSubmission(
        {
          chatState: superseded,
          activeRunId: activeRunId.current,
          pendingRequestId: pendingRequestId.current,
        },
        { requestId, userMessage },
      )
      if (!attempt.accepted) return
      const submission = attempt.state.chatState
      storeActiveRunBinding(null)

      pendingRequestId.current = attempt.state.pendingRequestId
      activeRunId.current = attempt.state.activeRunId
      projectionStateRef.current = submission
      messagesRef.current = submission.messages
      setMessages(submission.messages)
      updateConnectionStatus('running')

      socket.emit(
        'run:start',
        {
          requestId,
          messages: messagesForRun(submission.messages),
        },
        (ack: {
          ok: boolean
          runId?: string
          responseMessageId?: string
          error?: string
        }) => {
          if (pendingRequestId.current !== requestId) return
          pendingRequestId.current = null
          if (ack.ok && ack.runId && ack.responseMessageId) {
            activeRunId.current = ack.runId
            const next = bindRunStartAcknowledgement(
              projectionStateRef.current,
              {
                requestId,
                runId: ack.runId,
                responseMessageId: ack.responseMessageId,
              },
            )
            projectionStateRef.current = next
            messagesRef.current = next.messages
            setMessages(next.messages)
            if (next.runs[ack.runId].terminal) {
              storeActiveRunBinding(null)
              updateConnectionStatus('ready')
            } else {
              storeActiveRunBinding({
                runId: ack.runId,
                responseMessageId: ack.responseMessageId,
              })
            }
          } else {
            const next = failPendingRunStart(
              projectionStateRef.current,
              requestId,
            )
            projectionStateRef.current = next
            messagesRef.current = next.messages
            setMessages(next.messages)
            updateConnectionStatus('error')
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
      const requestId = crypto.randomUUID()
      const attempt = prepareRunSubmission(
        {
          chatState: projectionStateRef.current,
          activeRunId: activeRunId.current,
          pendingRequestId: pendingRequestId.current,
        },
        { requestId, userMessage },
      )
      if (!attempt.accepted) return false
      const submission = attempt.state.chatState

      pendingRequestId.current = attempt.state.pendingRequestId
      activeRunId.current = attempt.state.activeRunId
      projectionStateRef.current = submission
      messagesRef.current = submission.messages
      setMessages(submission.messages)
      updateConnectionStatus('running')

      socket.emit(
        'run:start',
        {
          requestId,
          messages: messagesForRun(submission.messages),
        },
        (ack: {
          ok: boolean
          runId?: string
          responseMessageId?: string
          error?: string
        }) => {
          if (pendingRequestId.current !== requestId) return
          pendingRequestId.current = null

          if (!ack.ok || !ack.runId || !ack.responseMessageId) {
            updateConnectionStatus('error')
            const failed = failPendingRunStart(
              projectionStateRef.current,
              requestId,
            )
            const next: ChatMessage[] = [
              ...failed.messages,
              {
                id: `error-${requestId}`,
                role: 'assistant',
                text: ack.error ?? 'No pude iniciar esa respuesta.',
              },
            ]
            projectionStateRef.current = { ...failed, messages: next }
            messagesRef.current = next
            setMessages(next)
            return
          }

          activeRunId.current = ack.runId
          const next = bindRunStartAcknowledgement(
            projectionStateRef.current,
            {
              requestId,
              runId: ack.runId,
              responseMessageId: ack.responseMessageId,
            },
          )
          projectionStateRef.current = next
          messagesRef.current = next.messages
          setMessages(next.messages)
          if (next.runs[ack.runId].terminal) {
            storeActiveRunBinding(null)
            updateConnectionStatus('ready')
          } else {
            storeActiveRunBinding({
              runId: ack.runId,
              responseMessageId: ack.responseMessageId,
            })
          }
        },
      )

      return true
    },
    [onNotify, t.attach],
  )

  useEffect(() => {
    const handlePromptRequest = (event: Event) => {
      const { prompt } = (event as CustomEvent<AriPromptRequestedDetail>).detail
      if (typeof prompt !== 'string' || !prompt.trim()) return
      dispatchMessage(prompt.trim(), [])
    }

    window.addEventListener(ARI_PROMPT_REQUESTED_EVENT, handlePromptRequest)
    return () => {
      window.removeEventListener(ARI_PROMPT_REQUESTED_EVENT, handlePromptRequest)
    }
  }, [dispatchMessage])

  const clearConversation = useCallback(() => {
    socketRef.current?.emit('conversation:clear', {}, () => undefined)

    try {
      localStorage.removeItem(CHAT_STORAGE_KEY)
      localStorage.removeItem(ACTIVE_RUN_STORAGE_KEY)
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
    queuedDecisions.current = []
    projectionStateRef.current = createChatState()
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
