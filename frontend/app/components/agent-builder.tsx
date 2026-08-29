'use client'

import type { Spec } from '@json-render/core'
import {
  Activity,
  CheckCircle2,
  Copy,
  FileText,
  MessageSquare,
  Paperclip,
  Rocket,
  Save,
  Send,
  Settings,
  Share2,
  Sparkles,
  ThumbsUp,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

import type { JsonRenderSpec } from '@/lib/json-render/catalog'
import { JsonRenderClient } from '@/app/json-render/render-client'

type ConnectionStatus = 'connecting' | 'ready' | 'running' | 'error'
type MessageRole = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: MessageRole
  text: string
  spec?: JsonRenderSpec
}

interface RunSnapshot {
  runId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  sequence: number
  ui: JsonRenderSpec | null
  error?: string
}

interface RunEnvelope {
  runId: string
  sequence: number
  type: 'run:status' | 'ui:replace' | 'run:complete'
  payload: Record<string, unknown>
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'
const fixedInstructions = `You are a helpful assistant.

For every user request, call renderDemoTool exactly once. Return the helpful answer through the fixed json-render demo components.`

const initialConversation: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    text: 'Hola. Soy Ari. ¿En qué puedo ayudarte hoy?',
  },
]

function responseText(spec: JsonRenderSpec): string {
  const root = spec.elements[spec.root]
  const props = root?.props as Record<string, unknown> | undefined
  return typeof props?.text === 'string' ? props.text : 'Respuesta renderizada.'
}

export default function AgentBuilderView({
  onNotify,
}: {
  onNotify: (message: string) => void
}) {
  const socketRef = useRef<Socket | null>(null)
  const activeRunId = useRef<string | null>(null)
  const pendingRequestId = useRef<string | null>(null)
  const latestSequence = useRef(0)
  const [tab, setTab] = useState('Test Agent')
  const [messages, setMessages] = useState<ChatMessage[]>(initialConversation)
  const [input, setInput] = useState('')
  const [agentName, setAgentName] = useState('Ari')
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('connecting')
  const [language, setLanguage] = useState('Español')
  const [purpose, setPurpose] = useState('Asistente general')
  const [company, setCompany] = useState('Muebles del Sur')
  const [companyDesc, setCompanyDesc] = useState(
    'Empresa de distribución y logística',
  )
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const socket = io(backendUrl, { transports: ['websocket'] })
    socketRef.current = socket

    function appendRenderedResponse(runId: string, spec: JsonRenderSpec) {
      setMessages((current) => {
        const id = `assistant-${runId}`
        if (current.some((message) => message.id === id)) return current

        return [
          ...current,
          {
            id,
            role: 'assistant',
            text: responseText(spec),
            spec,
          },
        ]
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
      if (snapshot.ui) appendRenderedResponse(snapshot.runId, snapshot.ui)

      if (snapshot.status === 'failed') {
        setMessages((current) => [
          ...current,
          {
            id: `error-${snapshot.runId}`,
            role: 'assistant',
            text: snapshot.error ?? 'No pude completar esa respuesta.',
          },
        ])
        setConnectionStatus('error')
      } else if (snapshot.status === 'completed') {
        setConnectionStatus('ready')
      } else {
        setConnectionStatus('running')
      }
    }

    socket.on('connect', () => {
      const runId = activeRunId.current
      setConnectionStatus(runId ? 'running' : 'ready')

      if (runId) {
        socket.emit(
          'run:join',
          { runId },
          (ack: { ok: boolean; snapshot?: RunSnapshot; error?: string }) => {
            if (ack.ok && ack.snapshot) {
              applySnapshot(ack.snapshot)
            } else {
              setConnectionStatus('error')
            }
          },
        )
      }
    })

    socket.on('connect_error', () => {
      setConnectionStatus('error')
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
        setConnectionStatus('running')
      }

      if (envelope.type === 'ui:replace') {
        appendRenderedResponse(
          envelope.runId,
          envelope.payload.spec as JsonRenderSpec,
        )
      }

      if (envelope.type === 'run:complete') {
        if (envelope.payload.status === 'failed') {
          setMessages((current) => [
            ...current,
            {
              id: `error-${envelope.runId}`,
              role: 'assistant',
              text: String(
                envelope.payload.error ?? 'No pude completar esa respuesta.',
              ),
            },
          ])
          setConnectionStatus('error')
        } else {
          setConnectionStatus('ready')
        }
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  function sendMessage() {
    const text = input.trim()
    const socket = socketRef.current

    if (!text || connectionStatus === 'running') return
    if (!socket?.connected) {
      onNotify(`No se pudo conectar con el backend en ${backendUrl}`)
      return
    }

    const userMessage: ChatMessage = {
      id: `user-${crypto.randomUUID()}`,
      role: 'user',
      text,
    }
    const nextMessages = [...messages, userMessage]
    const requestId = crypto.randomUUID()

    pendingRequestId.current = requestId
    activeRunId.current = null
    latestSequence.current = 0
    setMessages(nextMessages)
    setInput('')
    setConnectionStatus('running')

    socket.emit(
      'run:start',
      {
        requestId,
        messages: nextMessages
          .filter((message) => message.text)
          .slice(-40)
          .map(({ role, text: content }) => ({ role, content })),
      },
      (ack: { ok: boolean; runId?: string; error?: string }) => {
        if (pendingRequestId.current !== requestId) return
        pendingRequestId.current = null

        if (!ack.ok || !ack.runId) {
          setConnectionStatus('error')
          setMessages((current) => [
            ...current,
            {
              id: `error-${requestId}`,
              role: 'assistant',
              text: ack.error ?? 'No pude iniciar esa respuesta.',
            },
          ])
          return
        }

        activeRunId.current = ack.runId
      },
    )
  }

  function save() {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
    onNotify('Configuración del tracer guardada')
  }

  const connected = connectionStatus === 'ready'
  const hasImportantResult = messages.some((message) => Boolean(message.spec))
  const showContextPanel = connectionStatus === 'running' || hasImportantResult
  const statusLabel = {
    connecting: 'Conectando',
    ready: 'Conectado',
    running: 'Pensando',
    error: 'Sin conexión',
  }[connectionStatus]

  return (
    <div className={`agent-builder ${showContextPanel ? 'context-panel-visible' : 'context-panel-hidden'}`}>
      <div className="builder-left">
        <div className="chat-header">
          <div className="chat-brand">
            <Sparkles size={18} />
            <span>Agent Studio · json-render tracer</span>
          </div>
          <span
            className={`status-pill ${connected ? 'ok' : 'idle'}`}
            data-testid="chat-status"
          >
            <span />
            <b>{statusLabel}</b>
          </span>
        </div>

        <div className="chat-messages" aria-live="polite">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message ${message.role} ${message.spec ? 'rendered' : ''}`}
            >
              <div className="chat-avatar">
                {message.role === 'assistant' ? <Sparkles size={15} /> : 'AR'}
              </div>
              <div
                className={`chat-bubble ${message.spec ? 'json-render-bubble' : ''}`}
                data-testid={message.spec ? 'json-render-response' : undefined}
              >
                <small>{message.role === 'assistant' ? 'Ari' : 'Tú'}</small>
                {message.spec ? (
                  <JsonRenderClient spec={message.spec as Spec} />
                ) : (
                  <p>{message.text}</p>
                )}
                {message.role === 'assistant' && (
                  <div className="chat-actions">
                    <button
                      aria-label="Valorar"
                      onClick={() => onNotify('Respuesta valorada')}
                    >
                      <ThumbsUp size={13} />
                    </button>
                    <button
                      aria-label="Copiar"
                      onClick={() => {
                        void navigator.clipboard?.writeText(message.text)
                        onNotify('Respuesta copiada')
                      }}
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      aria-label="Compartir"
                      onClick={() => onNotify('Respuesta lista para compartir')}
                    >
                      <Share2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {connectionStatus === 'running' && (
            <div className="chat-message assistant">
              <div className="chat-avatar">
                <Sparkles size={15} />
              </div>
              <div className="chat-bubble typing-bubble">
                <small>Ari</small>
                <p>Preparando respuesta y componentes…</p>
              </div>
            </div>
          )}
        </div>

        <div className="chat-composer">
          <label className="attach-button" aria-label="Adjuntar archivo">
            <Paperclip size={17} />
            <input
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) onNotify(`${file.name} adjuntado`)
              }}
            />
          </label>
          <input
            value={input}
            disabled={connectionStatus === 'running'}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.nativeEvent.isComposing &&
                event.keyCode !== 229
              ) {
                sendMessage()
              }
            }}
            placeholder="Escribe un mensaje para Ari…"
            aria-label="Escribe un mensaje"
          />
          <button
            className="send-button"
            disabled={connectionStatus === 'running' || !input.trim()}
            onClick={sendMessage}
            aria-label="Enviar"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {showContextPanel && <div className="builder-right">
        <div className="context-panel-label">
          <span><Activity size={14} /> Contexto activo</span>
          <small>{connectionStatus === 'running' ? 'Ejecución en curso' : 'Último resultado importante'}</small>
        </div>
        <div className="config-header">
          <div>
            <h3>{agentName}</h3>
            <span className="status-pill ok">
              <span />
              <b>Tracer activo</b>
            </span>
          </div>
          <div className="config-actions">
            <button className="secondary-button" onClick={save}>
              {saved ? (
                <>
                  <CheckCircle2 size={14} /> Guardado
                </>
              ) : (
                <>
                  <Save size={14} /> Guardar
                </>
              )}
            </button>
            <button
              className="primary-button"
              onClick={() => onNotify('El tracer ya está activo')}
            >
              <Rocket size={14} /> Activo
            </button>
          </div>
        </div>

        <div className="config-tabs">
          {['Test Agent', 'Settings', 'Instructions'].map((item) => (
            <button
              key={item}
              className={tab === item ? 'selected' : ''}
              onClick={() => setTab(item)}
            >
              {item === 'Test Agent' && <MessageSquare size={14} />}
              {item === 'Settings' && <Settings size={14} />}
              {item === 'Instructions' && <FileText size={14} />}
              <span>{item}</span>
            </button>
          ))}
        </div>

        <div className="config-panel">
          {tab === 'Test Agent' && (
            <div className="config-block">
              <p>
                Conversa con Ari. Cada turno cruza Mastra, RunCoordinator,
                Socket.IO y el renderer validado por catálogo.
              </p>
              <div className="config-card">
                <div>
                  <span>Modelo activo</span>
                  <b>GPT-5 mini</b>
                </div>
                <div>
                  <span>Idioma</span>
                  <b>{language}</b>
                </div>
                <div>
                  <span>Salida</span>
                  <b>json-render</b>
                </div>
              </div>
            </div>
          )}

          {tab === 'Settings' && (
            <div className="config-block">
              <label className="field">
                <span>Language</span>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  <option>Español</option>
                  <option>Inglés</option>
                  <option>Francés</option>
                  <option>Portugués</option>
                </select>
              </label>
              <label className="field">
                <span>Agent Name</span>
                <input
                  value={agentName}
                  onChange={(event) => setAgentName(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Agent Purpose</span>
                <select
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                >
                  <option>Asistente general</option>
                  <option>Atención al cliente</option>
                  <option>Soporte técnico</option>
                </select>
              </label>
              <label className="field">
                <span>Company Name</span>
                <input
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                />
              </label>
              <label className="field textarea-field">
                <span>Company Description</span>
                <textarea
                  value={companyDesc}
                  onChange={(event) => setCompanyDesc(event.target.value)}
                />
              </label>
            </div>
          )}

          {tab === 'Instructions' && (
            <div className="config-block">
              <label className="field textarea-field">
                <span>Fixed system instructions</span>
                <textarea value={fixedInstructions} readOnly />
              </label>
              <div className="model-section">
                <label className="field">
                  <span>Model</span>
                  <input value="GPT-5 mini (OPENAI_MODEL)" readOnly />
                </label>
                <small>
                  Ari supplies the answer. The render tool supplies the fixed,
                  catalog-valid component tree.
                </small>
              </div>
            </div>
          )}
        </div>

        <div className="knowledge-section">
          <h4>Tracer contract</h4>
          <p>
            AssistantMessage → DeliveryCard → ContainerProgress. Component
            names and props are validated before state changes or UI events.
          </p>
        </div>
      </div>}
    </div>
  )
}

