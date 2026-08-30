'use client'

import type { Spec } from '@json-render/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

import type { JsonRenderSpec } from '@/lib/json-render/catalog'
import { JsonRenderClient } from './json-render/render-client'

type RunStatus = 'connecting' | 'pending' | 'running' | 'completed' | 'failed'

interface RunSnapshot {
  runId: string
  status: Exclude<RunStatus, 'connecting'>
  sequence: number
  ui: JsonRenderSpec | null
  error?: string
}

interface RunEnvelope {
  runId: string
  sequence: number
  type: 'run:status' | 'ui:replace' | 'run:complete'
  timestamp: string
  payload: Record<string, unknown>
}

import { getBackendUrl } from '@/lib/backend-url'

export function RunClient() {
  const socketRef = useRef<Socket | null>(null)
  const activeRunId = useRef<string | null>(null)
  const pendingStartRequestId = useRef<string | null>(null)
  const latestSequence = useRef(0)
  const [runId, setRunId] = useState<string | null>(null)
  const [status, setStatus] = useState<RunStatus>('connecting')
  const [spec, setSpec] = useState<JsonRenderSpec | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [customInput, setCustomInput] = useState('')

  const applySnapshot = useCallback((snapshot: RunSnapshot) => {
    if (
      activeRunId.current !== snapshot.runId ||
      snapshot.sequence < latestSequence.current
    ) {
      return
    }

    latestSequence.current = snapshot.sequence
    setRunId(snapshot.runId)
    setStatus(snapshot.status)
    setSpec(snapshot.ui)
    setError(snapshot.error ?? null)
  }, [])

  const joinRun = useCallback((socket: Socket, currentRunId: string) => {
    socket.emit(
      'run:join',
      { runId: currentRunId },
      (ack: { ok: boolean; snapshot?: RunSnapshot; error?: string }) => {
        if (ack.ok && ack.snapshot) {
          applySnapshot(ack.snapshot)
        } else if (activeRunId.current === currentRunId) {
          setStatus('failed')
          setError(ack.error ?? 'The run could not be rejoined.')
        }
      },
    )
  }, [applySnapshot])

  const startRun = useCallback((options: {
    socket?: Socket | null
    newRequest?: boolean
    prompt?: string
  } = {}) => {
    const socket = options.socket ?? socketRef.current
    if (!socket) return

    if (options.newRequest || !pendingStartRequestId.current) {
      pendingStartRequestId.current = crypto.randomUUID()
    }
    const requestId = pendingStartRequestId.current

    setStatus('pending')
    setSpec(null)
    setError(null)
    setRunId(null)
    latestSequence.current = 0
    activeRunId.current = null

    const payload: { requestId: string; messages?: Array<{ role: 'user'; content: string }> } = {
      requestId,
    }

    if (options.prompt) {
      payload.messages = [{ role: 'user', content: options.prompt }]
    }

    socket.emit('run:start', payload, (ack: { ok: boolean; runId?: string; error?: string }) => {
      if (pendingStartRequestId.current !== requestId) return

      if (!ack.ok || !ack.runId) {
        pendingStartRequestId.current = null
        setStatus('failed')
        setError(ack.error ?? 'The run could not be started.')
        return
      }

      pendingStartRequestId.current = null
      activeRunId.current = ack.runId
      setRunId(ack.runId)
      joinRun(socket, ack.runId)
    })
  }, [joinRun])

  // Escuchar selecciones de Human-in-the-Loop desde HumanDecisionCard
  useEffect(() => {
    const handleDecision = (event: Event) => {
      const customEvent = event as CustomEvent<{ optionId: string; payload: string }>
      const selected = customEvent.detail.payload || customEvent.detail.optionId
      startRun({
        newRequest: true,
        prompt: `The user selected: "${selected}". Proceed with this shipment and display the details.`,
      })
    }

    window.addEventListener('nauta:decision-selected', handleDecision)
    return () => {
      window.removeEventListener('nauta:decision-selected', handleDecision)
    }
  }, [startRun])

  useEffect(() => {
    const url = getBackendUrl()
    const socket = io(url, { transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect', () => {
      const currentRunId = activeRunId.current

      if (!currentRunId) {
        startRun({ socket })
        return
      }

      joinRun(socket, currentRunId)
    })

    socket.on('connect_error', () => {
      setStatus('failed')
      setError(`Cannot reach the backend at ${url}.`)
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
        setStatus(envelope.payload.status as RunStatus)
      }

      if (envelope.type === 'ui:replace') {
        setSpec(envelope.payload.spec as JsonRenderSpec)
      }

      if (envelope.type === 'run:complete') {
        const nextStatus = envelope.payload.status as RunStatus
        setStatus(nextStatus)
        setError(
          nextStatus === 'failed'
            ? String(envelope.payload.error ?? 'The run failed.')
            : null,
        )
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [joinRun, startRun])

  const handleSendCustomPrompt = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customInput.trim()) return
    startRun({ newRequest: true, prompt: customInput.trim() })
    setCustomInput('')
  }

  return (
    <main className="page-shell">
      <section className="engine-card">
        <header className="engine-header">
          <div>
            <p className="eyebrow">Nauta · Operational Brain &amp; AI Workforce</p>
            <h1>Ari · Autonomous Logistics Assistant</h1>
            <p className="lede">
              Real-time Supabase Queries + Human-in-the-Loop Decisions + Generative UI
            </p>
          </div>
          <div className={`status-badge status-${status}`} data-testid="run-status">
            <span aria-hidden="true" />
            {status}
          </div>
        </header>

        <div className="run-meta">
          <span>Run ID</span>
          <code>{runId ?? 'waiting for acknowledgement…'}</code>
        </div>

        <section className="result-panel" data-testid="json-render-result">
          {spec ? (
            <JsonRenderClient spec={spec as Spec} />
          ) : (
            <p className="placeholder">
              {error ?? 'Ari is querying the database and preparing the response…'}
            </p>
          )}
        </section>

        <form onSubmit={handleSendCustomPrompt} className="my-4 flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Ask Ari (e.g. Have the dining tables arrived yet?, Where is container MSKU1234567?)"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
          >
            Query
          </button>
        </form>

        <footer className="engine-footer">
          <p>Interactive UI generated dynamically based on agent decisions and live database state.</p>
          <button type="button" onClick={() => startRun({ newRequest: true })}>
            Restart demo
          </button>
        </footer>
      </section>
    </main>
  )
}
