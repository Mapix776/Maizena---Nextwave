'use client'

import type { Spec } from '@json-render/core'
import { Renderer } from '@json-render/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

import type { TracerSpec } from './catalog'
import { tracerRegistry } from './registry'

type RunStatus = 'connecting' | 'pending' | 'running' | 'completed' | 'failed'

interface RunSnapshot {
  runId: string
  status: Exclude<RunStatus, 'connecting'>
  sequence: number
  ui: TracerSpec | null
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
  const latestSequence = useRef(0)
  const [runId, setRunId] = useState<string | null>(null)
  const [status, setStatus] = useState<RunStatus>('connecting')
  const [spec, setSpec] = useState<TracerSpec | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startRun = useCallback((socket = socketRef.current) => {
    if (!socket) return

    setStatus('pending')
    setSpec(null)
    setError(null)
    latestSequence.current = 0
    activeRunId.current = null

    socket.emit('run:start', {}, (ack: { ok: boolean; runId?: string; error?: string }) => {
      if (!ack.ok || !ack.runId) {
        setStatus('failed')
        setError(ack.error ?? 'The run could not be started.')
        return
      }

      activeRunId.current = ack.runId
      setRunId(ack.runId)
    })
  }, [])

  useEffect(() => {
    const socket = io(backendUrl, { transports: ['websocket'] })
    socketRef.current = socket

    const applySnapshot = (snapshot: RunSnapshot) => {
      activeRunId.current = snapshot.runId
      latestSequence.current = snapshot.sequence
      setRunId(snapshot.runId)
      setStatus(snapshot.status)
      setSpec(snapshot.ui)
      setError(snapshot.error ?? null)
    }

    socket.on('connect', () => {
      const currentRunId = activeRunId.current

      if (!currentRunId) {
        startRun(socket)
        return
      }

      socket.emit(
        'run:join',
        { runId: currentRunId },
        (ack: { ok: boolean; snapshot?: RunSnapshot; error?: string }) => {
          if (ack.ok && ack.snapshot) {
            applySnapshot(ack.snapshot)
          } else {
            setStatus('failed')
            setError(ack.error ?? 'The run could not be rejoined.')
          }
        },
      )
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
        setSpec(envelope.payload.spec as TracerSpec)
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
  }, [startRun])

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
            <Renderer spec={spec as Spec} registry={tracerRegistry} />
          ) : (
            <p className="placeholder">
              {error ?? 'The deterministic hello tool is running…'}
            </p>
          )}
        </section>

        <footer className="engine-footer">
          <p>Rendered only from the catalog-validated spec received over Socket.IO.</p>
          <button type="button" onClick={() => startRun()}>
            Run again
          </button>
        </footer>
      </section>
    </main>
  )
}
