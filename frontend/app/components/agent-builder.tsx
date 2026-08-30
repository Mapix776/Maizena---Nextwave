'use client'

import type { Spec } from '@json-render/core'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Landmark,
  ListTree,
  MessageSquare,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Rocket,
  RotateCcw,
  Save,
  Send,
  Settings,
  Share2,
  Ship,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { getTranslations, type Locale } from '@/lib/i18n'

import type { JsonRenderSpec } from '@/lib/json-render/catalog'
import { JsonRenderClient } from '@/app/json-render/render-client'
import { ThinkingAnimation } from '@/components/chat/thinking-animation'
import { DocumentSheetView } from '@/components/logistics/document-sheet-view'

type ConnectionStatus = 'connecting' | 'ready' | 'running' | 'error'
type MessageRole = 'user' | 'assistant'

interface ChatAttachment {
  id: string
  name: string
  size: number
  type: string
  url: string
}

interface ChatMessage {
  id: string
  role: MessageRole
  text: string
  attachments?: ChatAttachment[]
  spec?: JsonRenderSpec
}

type ContextItem = {
  id: string
  title: string
  kind: 'Documento' | 'Informe' | 'Detalle'
  description: string
  sourceId: string
  elementType: string
  props: Record<string, unknown>
  url?: string
  mimeType?: string
}

// Element types that should render as a formatted A4 trade document sheet.
const DOCUMENT_SHEET_TYPES = new Set([
  'DocumentDetailsCard',
  'CustomsClearancePanel',
  'ShipmentDocumentsTimeline',
])

function contextItemsFromSpec(spec: JsonRenderSpec, sourceId: string): ContextItem[] {
  return Object.entries(spec.elements).map(([id, element], index) => {
    const props = element.props as Record<string, unknown>
    const kind = element.type.toLowerCase().includes('issue')
      ? 'Informe'
      : element.type.toLowerCase().includes('document')
        ? 'Documento'
        : 'Detalle'
    const title = typeof props.title === 'string'
      ? props.title
      : typeof props.reference === 'string'
        ? props.reference
        : `${kind} ${index + 1}`
    const url = typeof props.url === 'string' ? props.url : typeof props.fileUrl === 'string' ? props.fileUrl : undefined
    return {
      id: `${sourceId}-${id}`,
      title,
      kind,
      description: typeof props.description === 'string'
        ? props.description
        : `Información contextual de ${title.toLowerCase()}.`,
      sourceId,
      elementType: element.type,
      props,
      url,
      mimeType: typeof props.mimeType === 'string' ? props.mimeType : undefined,
    }
  })
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
const fixedInstructions = `You are Ari, the lead logistics agent.

Ground operational answers in the live Supabase query tools. Delegate Bill of Lading, Commercial Invoice, and Packing List reconciliation to Recon.

Return client-friendly explanations and preserve validated structured tool results so the backend can compose evidence-backed json-render components.`

const initialConversation: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    text: 'Hola. Soy Ari. Puedo ayudarte y delegar la reconciliación de BL, Invoice y Packing List a Recon.',
  },
]

const CHAT_STORAGE_KEY = 'nauta_chat_messages_v1'

function loadStoredMessages(): ChatMessage[] | null {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as ChatMessage[]
  } catch (error) {
    console.error('Error al leer historial local:', error)
  }
  return null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function responseText(spec: JsonRenderSpec): string {
  const root = spec.elements[spec.root]
  const props = root?.props as Record<string, unknown> | undefined
  return typeof props?.text === 'string' ? props.text : 'Respuesta renderizada.'
}

function savedTitle(spec: JsonRenderSpec, fallback: string): string {
  for (const element of Object.values(spec.elements)) {
    const props = element.props as Record<string, unknown>
    if (typeof props?.title === 'string' && props.title.trim()) return props.title
    if (typeof props?.reference === 'string' && props.reference.trim()) return props.reference
  }
  const text = fallback.trim()
  if (!text) return 'Tarjeta guardada'
  return text.length > 60 ? `${text.slice(0, 57)}…` : text
}

type TraceStep = { title: string; detail: string }

const ELEMENT_STEP_LABELS: Record<string, string> = {
  AssistantMessage: 'mensaje del asistente',
  OperationSummaryCard: 'resumen de la operación',
  OperationsMetricsCard: 'métricas de operaciones',
  ContainerProgress: 'progreso de contenedores',
  DeliveryCard: 'estado de la entrega',
  DeliveryIssueCard: 'incidencia de entrega',
  OperationalAlertList: 'alertas operativas',
  EtaRiskCard: 'riesgo de ETA',
  ShipmentMilestoneTimeline: 'hitos del embarque',
  ShipmentDocumentsTimeline: 'línea de documentos',
  CustomsClearancePanel: 'despacho de aduana',
  DocumentDetailsCard: 'detalle de documentos',
  ReconciliationFindings: 'hallazgos de reconciliación',
  HumanDecisionCard: 'decisión humana requerida',
  AgentRunTimeline: 'cronología del agente',
  BarChart: 'gráfico de barras',
  InteractiveChart: 'gráfico interactivo',
  CatalogChart: 'gráfico del catálogo',
}

const DOCUMENT_ELEMENT_TYPES = new Set([
  'DocumentDetailsCard',
  'ReconciliationFindings',
  'ShipmentDocumentsTimeline',
  'CustomsClearancePanel',
])

// Reconstructs, from the validated result spec, the pipeline Ari followed to
// produce it. Grounded in the real elements the backend composed.
function deriveTraceSteps(spec: JsonRenderSpec): TraceStep[] {
  const types = Object.values(spec.elements).map((element) => element.type)
  const hasDocuments = types.some((type) => DOCUMENT_ELEMENT_TYPES.has(type))
  const componentNames = types
    .map((type) => ELEMENT_STEP_LABELS[type] ?? type)
    .filter((name, index, all) => all.indexOf(name) === index)

  const steps: TraceStep[] = [
    {
      title: 'Interpretar la solicitud',
      detail: 'Ari analiza tu mensaje y decide qué herramientas de datos y agentes necesita.',
    },
    {
      title: 'Consultar datos operativos',
      detail: 'Ejecuta las tools de Supabase para traer operaciones, contenedores y estados verificados en tiempo real.',
    },
  ]

  if (hasDocuments) {
    steps.push({
      title: 'Reconciliar documentos',
      detail: 'Delega en Recon el cruce de Bill of Lading, Commercial Invoice y Packing List para detectar discrepancias.',
    })
  }

  steps.push({
    title: 'Componer la evidencia',
    detail: `Estructura ${componentNames.length} componente${componentNames.length === 1 ? '' : 's'}: ${componentNames.join(', ')}.`,
  })

  steps.push({
    title: 'Validar y renderizar',
    detail: 'El resultado pasa por el catálogo json-render validado antes de mostrarse en el chat.',
  })

  return steps
}

export default function AgentBuilderView({
  onNotify,
  locale = 'es',
  sidebarOpen = true,
  onToggleSidebar,
  isSaved,
  onToggleSave,
}: {
  onNotify: (message: string) => void
  locale?: Locale
  sidebarOpen?: boolean
  onToggleSidebar?: () => void
  isSaved?: (id: string) => boolean
  onToggleSave?: (entry: { id: string; title: string; spec: JsonRenderSpec }) => boolean
}) {
  const t = getTranslations(locale)
  const socketRef = useRef<Socket | null>(null)
  const activeRunId = useRef<string | null>(null)
  const pendingRequestId = useRef<string | null>(null)
  const latestSequence = useRef(0)
  const messagesEnd = useRef<HTMLDivElement | null>(null)
  const shouldAutoScroll = useRef(true)
  const [tab, setTab] = useState('Test Agent')
  const [messages, setMessages] = useState<ChatMessage[]>(initialConversation)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
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
  const [contextItems, setContextItems] = useState<ContextItem[]>([])
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null)
  const [contextSpec, setContextSpec] = useState<JsonRenderSpec | null>(null)
  const [panelView, setPanelView] = useState<'detail' | 'trace'>('detail')
  const [savedDocIds, setSavedDocIds] = useState<Set<string>>(new Set())
  const [savingDocId, setSavingDocId] = useState<string | null>(null)

  const shareConversation = async () => {
    const transcript = messages.map((message) => `${message.role === 'assistant' ? 'Ari' : 'Tú'}: ${message.text}`).join('\n\n')
    if (navigator.share) {
      await navigator.share({ title: 'Conversación con Ari', text: transcript })
    } else {
      await navigator.clipboard?.writeText(transcript)
      onNotify(t.responseShare)
    }
  }

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

  // Auto-send when user clicks a Human-in-the-Loop decision option card
  useEffect(() => {
    const handleDecision = (event: Event) => {
      const customEvent = event as CustomEvent<{ optionId: string; payload: string }>
      const selected = customEvent.detail.payload || customEvent.detail.optionId
      const socket = socketRef.current
      if (!socket?.connected) return

      const userMessage: ChatMessage = {
        id: `user-${crypto.randomUUID()}`,
        role: 'user',
        text: `Selected option: "${selected}". Proceed with this decision.`,
      }
      const nextMessages = [...messages, userMessage]
      const requestId = crypto.randomUUID()

      pendingRequestId.current = requestId
      activeRunId.current = null
      latestSequence.current = 0
      setMessages(nextMessages)
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
          if (ack.ok && ack.runId) {
            activeRunId.current = ack.runId
          }
        },
      )
    }

    window.addEventListener('nauta:decision-selected', handleDecision)
    return () => {
      window.removeEventListener('nauta:decision-selected', handleDecision)
    }
  }, [messages])

  useEffect(() => {
    if (shouldAutoScroll.current) {
      messagesEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, connectionStatus])

  // Restore chat history from localStorage after mount (client only).
  useEffect(() => {
    const stored = loadStoredMessages()
    if (stored) setMessages(stored)
  }, [])

  // Persist chat history whenever it changes, skipping the untouched seed.
  useEffect(() => {
    if (messages === initialConversation) return
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages))
    } catch (error) {
      console.error('Error al guardar historial local:', error)
    }
  }, [messages])

  function handleClearChat() {
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY)
    } catch (error) {
      console.error('Error al limpiar historial local:', error)
    }
    activeRunId.current = null
    pendingRequestId.current = null
    latestSequence.current = 0
    setMessages(initialConversation)
    setContextItems([])
    setContextSpec(null)
    setInput('')
    setAttachments([])
    onNotify(t.newChatDone)
  }

  function dispatchMessage(text: string, atts: ChatAttachment[]) {
    const socket = socketRef.current

    if ((!text && atts.length === 0) || connectionStatus === 'running') return
    if (!socket?.connected) {
      onNotify(`No se pudo conectar con el backend en ${backendUrl}`)
      return
    }

    const userMessage: ChatMessage = {
      id: `user-${crypto.randomUUID()}`,
      role: 'user',
      text: text || t.attach,
      attachments: atts.length ? atts : undefined,
    }
    const nextMessages = [...messages, userMessage]
    const requestId = crypto.randomUUID()

    pendingRequestId.current = requestId
    activeRunId.current = null
    latestSequence.current = 0
    setMessages(nextMessages)
    setInput('')
    setAttachments([])
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

  function sendMessage() {
    dispatchMessage(input.trim(), attachments)
  }

  function sendQuickPrompt(promptText: string) {
    dispatchMessage(promptText, [])
  }

  function save() {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
    onNotify('Configuración del tracer guardada')
  }

  const connected = connectionStatus === 'ready'
  function openContextPanel(spec: JsonRenderSpec, sourceId: string) {
    const items = contextItemsFromSpec(spec, sourceId)
    setContextItems(items)
    setSelectedContextId(items[0]?.id ?? null)
    setContextSpec(spec)
    setPanelView('detail')
  }

  function openAttachment(attachment: ChatAttachment, sourceId: string) {
    const item: ContextItem = {
      id: `${sourceId}-${attachment.id}`,
      title: attachment.name,
      kind: 'Documento',
      description: `Vista previa de ${attachment.name}.`,
      sourceId,
      elementType: 'Attachment',
      props: {},
      url: attachment.url,
      mimeType: attachment.type,
    }
    setContextItems([item])
    setSelectedContextId(item.id)
    setContextSpec(null)
    setPanelView('detail')
  }

  function closeContextPanel() {
    setContextItems([])
    setContextSpec(null)
    setPanelView('detail')
  }

  const selectedContext = contextItems.find((item) => item.id === selectedContextId)
  const showContextPanel = contextItems.length > 0

  async function saveDocToS3(item: ContextItem) {
    if (savedDocIds.has(item.id) || savingDocId) return
    setSavingDocId(item.id)
    try {
      const response = await fetch(`${backendUrl}/documents/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          type: item.elementType,
          title: item.title,
          reference: item.props.reference ?? null,
          props: item.props,
        }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setSavedDocIds((current) => new Set(current).add(item.id))
      onNotify(t.saveToS3Done)
    } catch (error) {
      console.error('[v0] Error guardando documento en S3:', error)
      onNotify(t.saveToS3Error)
    } finally {
      setSavingDocId(null)
    }
  }

  function downloadDoc(item: ContextItem) {
    const scalarLines = Object.entries(item.props)
      .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
      .map(([key, value]) => `${key}: ${value}`)
    const content = ['NAUTA FREIGHT & CUSTOMS', item.title, '', ...scalarLines].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${item.title.replace(/\s+/g, '-').toLowerCase()}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }
  const traceSteps = contextSpec ? deriveTraceSteps(contextSpec) : []
  const showTraceTab = traceSteps.length > 0
  const statusLabel = {
    connecting: t.connecting,
    ready: t.connected,
    running: t.thinkingStatus,
    error: t.offline,
  }[connectionStatus]

  return (
    <div className={`agent-builder ${showContextPanel ? 'context-panel-visible' : 'context-panel-hidden'}`}>
      <div className="builder-left">
        <div className="chat-header">
          {onToggleSidebar && (
            <button type="button" className="chat-header-toggle" onClick={onToggleSidebar} aria-label={sidebarOpen ? 'Ocultar panel' : 'Mostrar panel'}>
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
          )}
          <div className="chat-header-title">
            <span className="chat-header-avatar"><Sparkles size={15} /></span>
            <div>
              <b>{agentName}</b>
              <small>Asistente de logística de Nauta</small>
            </div>
          </div>
          <span
            className={`status-pill ${connected ? 'ok' : 'idle'}`}
            data-testid="chat-status"
          >
            <span />
            <b>{statusLabel}</b>
          </span>
          <button type="button" className="chat-share-button" onClick={handleClearChat} aria-label={t.newChat}>
            <RotateCcw size={14} /> <span>{t.newChat}</span>
          </button>
          <button type="button" className="chat-share-button" onClick={() => void shareConversation()} aria-label={t.share}>
            <Share2 size={14} /> <span>{t.share}</span>
          </button>
        </div>

        <div
          className="chat-messages"
          aria-live="polite"
          onScroll={(event) => {
            const element = event.currentTarget
            shouldAutoScroll.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80
          }}
        >
          {messages.length <= 1 && connectionStatus !== 'running' ? (
            <div className="chat-empty-state">
              <span className="chat-empty-avatar"><Sparkles size={22} /></span>
              <h2>Hola, soy {agentName}</h2>
              <p>Asistente de logística de Nauta. Puedo ayudarte a consultar operaciones, revisar documentos de comercio exterior y reconciliar BL, Invoice y Packing List.</p>
              <p className="chat-empty-title">¿Qué necesitas consultar?</p>
              <div className="chat-empty-prompts">
                {[
                  { icon: Ship, label: 'Embarques', prompt: 'Muéstrame el estado de mis embarques activos.' },
                  { icon: Package, label: 'Contenedores', prompt: 'Revisa el estado de mis contenedores en tránsito.' },
                  { icon: FileText, label: 'Documentos', prompt: 'Reconcilia el Bill of Lading, la Commercial Invoice y el Packing List.' },
                  { icon: Landmark, label: 'Aduanas', prompt: 'Consulta el estado de mis trámites de aduana.' },
                  { icon: AlertTriangle, label: 'Incidencias', prompt: 'Muéstrame las incidencias abiertas en mis operaciones.' },
                  { icon: BarChart3, label: 'Analíticas', prompt: 'Muéstrame las analíticas y métricas de mis operaciones.' },
                ].map(({ icon: Icon, label, prompt }) => (
                  <button key={label} type="button" className="chat-prompt-chip" onClick={() => sendQuickPrompt(prompt)}>
                    <Icon size={16} className="chat-prompt-icon" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message ${message.role} ${message.spec ? 'rendered' : ''}`}
            >
              <div className="chat-avatar">
                {message.role === 'assistant' ? <Sparkles size={15} /> : 'AR'}
              </div>
              <div className="chat-message-content">
                <small className="chat-message-author">{message.role === 'assistant' ? 'Ari' : 'Tú'}</small>
                <div
                  className={`chat-bubble ${message.spec ? 'json-render-bubble json-render-inline' : ''}`}
                  data-testid={message.spec ? 'json-render-response' : undefined}
                >
                {message.attachments && (
                  <div className="chat-attachments" aria-label="Archivos adjuntos">
                    {message.attachments.map((attachment) => (
                      <button className="chat-attachment" key={attachment.id} type="button" onClick={() => openAttachment(attachment, message.id)}>
                        <FileText size={16} />
                        <span><b>{attachment.name}</b><small>{formatFileSize(attachment.size)}</small></span>
                      </button>
                    ))}
                  </div>
                )}
                {message.spec ? (
                  <>
                    <div className="json-render-toolbar">
                      <button
                        className="open-context-button"
                        onClick={() => openContextPanel(message.spec as JsonRenderSpec, message.id)}
                      >
                        <FileText size={13} /> {t.openInfo}
                      </button>
                      {onToggleSave && (
                        <button
                          className={`save-card-button ${isSaved?.(message.id) ? 'saved' : ''}`}
                          aria-pressed={isSaved?.(message.id) ?? false}
                          onClick={() => {
                            const nowSaved = onToggleSave({
                              id: message.id,
                              title: savedTitle(message.spec as JsonRenderSpec, message.text),
                              spec: message.spec as JsonRenderSpec,
                            })
                            onNotify(nowSaved ? t.saveCardDone : t.unsaveCardDone)
                          }}
                        >
                          {isSaved?.(message.id) ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                          {isSaved?.(message.id) ? t.savedCardShort : t.saveCard}
                        </button>
                      )}
                    </div>
                    <JsonRenderClient spec={message.spec as Spec} />
                  </>
                ) : (
                  <p>{message.text}</p>
                )}
                </div>
                {message.role === 'assistant' && (
                  <div className="chat-actions">
                    <button aria-label={t.copy} onClick={() => { void navigator.clipboard?.writeText(message.text); onNotify('Respuesta copiada') }}><Copy size={13} /></button>
                    <button aria-label={t.responseRated} onClick={() => onNotify('Respuesta valorada')}><ThumbsUp size={13} /></button>
                    <button aria-label="Marcar como poco útil" onClick={() => onNotify('Gracias por tu opinión')}><ThumbsDown size={13} /></button>
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
                <div className="chat-thinking-state" role="status" aria-label={t.thinking}>
                  <ThinkingAnimation type="thinking" />
                  <div>
                    <p>{t.thinking}</p>
                    <div className="thinking-progress" aria-hidden="true"><span /></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEnd} />
        </div>

        <div className="chat-composer">
          <div className={`composer-inner ${connectionStatus === 'running' ? 'is-sending' : ''}`}>
          {attachments.length > 0 && (
            <div className="pending-attachments" aria-label="Archivos seleccionados">
              {attachments.map((attachment) => (
                <div className="pending-attachment" key={attachment.id}>
                  <FileText size={14} />
                  <span>{attachment.name}</span>
                  <button type="button" aria-label={`Quitar ${attachment.name}`} onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}>×</button>
                </div>
              ))}
            </div>
          )}
          <div className="composer-row">
          <label className="attach-button" aria-label="Adjuntar archivo">
            <Paperclip size={18} />
            <input
              type="file"
              onChange={(event) => {
                const selectedFiles = Array.from(event.target.files ?? [])
                if (!selectedFiles.length) return
                const nextAttachments = selectedFiles.map((file) => ({
                  id: `${file.name}-${file.lastModified}`,
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  url: URL.createObjectURL(file),
                }))
                setAttachments((current) => [...current, ...nextAttachments])
                onNotify(`${selectedFiles.length} archivo${selectedFiles.length === 1 ? '' : 's'} adjuntado${selectedFiles.length === 1 ? '' : 's'}`)
                event.currentTarget.value = ''
              }}
            />
          </label>
          <textarea
            rows={1}
            value={input}
            disabled={connectionStatus === 'running'}
            onChange={(event) => {
              setInput(event.target.value)
              event.target.style.height = 'auto'
              event.target.style.height = `${Math.min(event.target.scrollHeight, 168)}px`
            }}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                event.keyCode !== 229
              ) {
                event.preventDefault()
                sendMessage()
              }
            }}
            placeholder={t.chatPlaceholder}
            aria-label={t.chatPlaceholder}
          />
          <button
            className="send-button"
            disabled={connectionStatus === 'running' || (!input.trim() && attachments.length === 0)}
            onClick={sendMessage}
            aria-label="Enviar"
          >
            <Send size={18} />
          </button>
          </div>
          </div>
        </div>
      </div>

      {showContextPanel && <div className="builder-right">
        <div className="context-panel-label">
          <span><Activity size={14} /> {t.contextualInfo}</span>
          <button aria-label="Cerrar panel" onClick={closeContextPanel}>×</button>
        </div>
        <div className="context-view-tabs" role="tablist" aria-label={t.availableInfo}>
          <button role="tab" aria-selected={panelView === 'detail'} className={panelView === 'detail' ? 'selected' : ''} onClick={() => setPanelView('detail')}>
            <FileText size={14} /> {t.detailTab}
          </button>
          {showTraceTab && (
            <button role="tab" aria-selected={panelView === 'trace'} className={panelView === 'trace' ? 'selected' : ''} onClick={() => setPanelView('trace')}>
              <ListTree size={14} /> {t.stepByStepTab}
            </button>
          )}
        </div>
        {panelView === 'detail' && <>
        <div className="context-tabs" role="tablist" aria-label={t.availableInfo}>
          {contextItems.map((item) => (
            <button key={item.id} role="tab" aria-selected={selectedContextId === item.id} className={selectedContextId === item.id ? 'selected' : ''} onClick={() => setSelectedContextId(item.id)}>
              <small>{item.kind}</small><span>{item.title}</span>
            </button>
          ))}
        </div>
        {selectedContext && (
          <div className="context-detail">
            <span>{selectedContext.kind}</span>
            <h3>{selectedContext.title}</h3>
            {selectedContext.url ? (
              <>
                <p>{selectedContext.description}</p>
                {selectedContext.mimeType?.startsWith('image/')
                  ? <img className="context-file-preview" src={selectedContext.url} alt={selectedContext.title} />
                  : selectedContext.mimeType === 'application/pdf'
                    ? <iframe className="context-file-preview" src={selectedContext.url} title={selectedContext.title} />
                    : <a className="context-file-link" href={selectedContext.url} target="_blank" rel="noreferrer">{t.viewFile}</a>}
              </>
            ) : DOCUMENT_SHEET_TYPES.has(selectedContext.elementType) ? (
              <>
                <div className="doc-sheet-toolbar">
                  <span className="doc-ai-badge"><Sparkles size={12} /> {t.aiGenerated}</span>
                  <div className="doc-sheet-actions">
                    <button
                      type="button"
                      className={`secondary-button ${savedDocIds.has(selectedContext.id) ? 'saved' : ''}`}
                      onClick={() => void saveDocToS3(selectedContext)}
                      disabled={savingDocId === selectedContext.id || savedDocIds.has(selectedContext.id)}
                    >
                      {savedDocIds.has(selectedContext.id)
                        ? <><CheckCircle2 size={13} /> {t.savedToS3}</>
                        : savingDocId === selectedContext.id
                          ? t.savingToS3
                          : <><Save size={13} /> {t.saveToS3}</>}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => downloadDoc(selectedContext)}>
                      <Download size={13} /> {t.downloadDoc}
                    </button>
                  </div>
                </div>
                <DocumentSheetView title={selectedContext.title} props={selectedContext.props} />
              </>
            ) : (
              <p>{selectedContext.description}</p>
            )}
            <small>Origen: {selectedContext.sourceId}</small>
          </div>
        )}
        </>}
        {panelView === 'trace' && showTraceTab && (
          <div className="context-trace">
            <p className="context-trace-intro">{t.stepByStepIntro}</p>
            <ol className="trace-steps">
              {traceSteps.map((step, index) => (
                <li key={step.title} className="trace-step">
                  <span className="trace-step-marker">{index + 1}</span>
                  <div className="trace-step-body">
                    <b>{step.title}</b>
                    <p>{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
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
                  <b>Recon → json-render</b>
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
                  <input
                    value="GPT-5.6 Luna · main: medium · Recon: none"
                    readOnly
                  />
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
            Ari → Recon → reconcileShipmentDocumentsTool → renderDemoTool.
            Recon alone owns the reconciliation capability; rendered component
            names and props remain catalog-validated.
          </p>
        </div>
      </div>}
    </div>
  )
}
