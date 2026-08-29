'use client'

import type { Spec } from '@json-render/core'
import { Renderer } from '@json-render/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

import type { JsonRenderSpec } from '@/lib/json-render/catalog'
import { registry } from '@/lib/json-render/registry'

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

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

export function RunClient() {
  const socketRef = useRef<Socket | null>(null)
  const activeRunId = useRef<string | null>(null)
  const pendingStartRequestId = useRef<string | null>(null)
  const latestSequence = useRef(0)
  const [runId, setRunId] = useState<string | null>(null)
  const [status, setStatus] = useState<RunStatus>('connecting')
  const [spec, setSpec] = useState<JsonRenderSpec | null>(null)
  const [error, setError] = useState<string | null>(null)

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

    socket.emit('run:start', { requestId }, (ack: { ok: boolean; runId?: string; error?: string }) => {
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

  useEffect(() => {
    const socket = io(backendUrl, { transports: ['websocket'] })
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
      setError(`Cannot reach the backend at ${backendUrl}.`)
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

  return (
    <main className="page-shell">
      <section className="engine-card">
        <header className="engine-header">
          <div>
            <p className="eyebrow">Nauta · engine tracer</p>
            <h1>Ari, end to end</h1>
            <p className="lede">
              Mastra → RunCoordinator → Socket.IO → json-render
            </p>
          </div>
          <div className={`status-badge status-${status}`} data-testid="run-status">
            <span aria-hidden="true" />
            {status}
          </div>
        </header>

        <div className="run-meta">
          <span>Run</span>
          <code>{runId ?? 'waiting for acknowledgement'}</code>
        </div>

        <section className="result-panel" data-testid="json-render-result">
          {spec ? (
            <Renderer spec={spec as Spec} registry={registry} />
          ) : (
            <p className="placeholder">
              {error ?? 'The deterministic hello tool is running…'}
            </p>
          )}
        </section>

        <footer className="engine-footer">
          <p>Rendered only from the catalog-validated spec received over Socket.IO.</p>
          <button type="button" onClick={() => startRun({ newRequest: true })}>
            Run again
          </button>
        </footer>
      </section>
    </main>
  )
}
