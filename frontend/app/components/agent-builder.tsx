'use client'

import type { Spec } from '@json-render/core'
import type { FileUIPart } from 'ai'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Landmark,
  ListTree,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  RotateCcw,
  Save,
  Share2,
  Ship,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from '@/components/ai-elements/attachments'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from '@/components/ai-elements/prompt-input'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import { Button } from '@/components/ui/button'
import {
  ThinkingAnimation,
  type ThinkingAnimationType,
} from '@/components/chat/thinking-animation'
import { DocumentSheetView } from '@/components/logistics/document-sheet-view'
import { JsonRenderClient } from '@/app/json-render/render-client'
import { getTranslations, type Locale } from '@/lib/i18n'
import type { JsonRenderSpec } from '@/lib/json-render/catalog'
import {
  type ChatAttachment,
  type ChatMessage,
  type ConnectionStatus,
  type TraceStep,
  useAriChat,
} from '@/lib/use-ari-chat'

type ContextItem = {
  id: string
  title: string
  kind:
    | 'Documento'
    | 'Documentos'
    | 'Informe'
    | 'Detalle'
    | 'Ficha'
    | 'Ficha Aduanal'
    | 'Alertas Operativas'
    | 'Seguimiento'
  description: string
  sourceId: string
  elementType: string
  props: Record<string, unknown>
  url?: string
  mimeType?: string
}

const DOCUMENT_SHEET_TYPES = new Set([
  'DocumentDetailsCard',
  'CustomsClearancePanel',
  'ShipmentDocumentsTimeline',
])

function contextItemsFromSpec(
  spec: JsonRenderSpec,
  sourceId: string,
): ContextItem[] {
  return Object.entries(spec.elements)
    .filter(([, element]) => {
      // Solo incluir elementos con visor de ficha real o archivo adjunto,
      // para evitar pestañas en blanco (ej. "Ficha 1", "Ficha 5").
      const props = element.props as Record<string, unknown> | undefined
      const isDocSheet = DOCUMENT_SHEET_TYPES.has(element.type)
      const hasFileUrl = Boolean(props?.url || props?.fileUrl)
      return isDocSheet || hasFileUrl
    })
    .map(([id, element], index) => {
    const props = element.props as Record<string, unknown>
    const type = element.type.toLowerCase()
    const isCustoms = type.includes('customs') || type.includes('aduan')
    const kind = isCustoms ? 'Ficha Aduanal' : 'Documentos'
    const title =
      typeof props.title === 'string' && props.title.trim()
        ? props.title
        : typeof props.containerNumber === 'string'
          ? `Aduana · ${props.containerNumber}`
          : typeof props.reference === 'string'
            ? props.reference
            : typeof props.name === 'string'
              ? props.name
              : isCustoms
                ? `Ficha Aduanal ${index + 1}`
                : `Documento ${index + 1}`
    const url =
      typeof props.url === 'string'
        ? props.url
        : typeof props.fileUrl === 'string'
          ? props.fileUrl
          : undefined

    return {
      id: `${sourceId}-${id}`,
      title,
      kind,
      description:
        typeof props.description === 'string'
          ? props.description
          : 'Expediente documental certificado.',
      sourceId,
      elementType: element.type,
      props,
      url,
      mimeType:
        typeof props.mimeType === 'string' ? props.mimeType : undefined,
    }
  })
}

const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

const THINKING_COPY: Record<ThinkingAnimationType, string> = {
  thinking: 'Ari está procesando tu solicitud...',
  reading: 'Ari está extrayendo datos del documento...',
  drawing: 'Ari está construyendo la visualización...',
  mapping: 'Ari está trazando la ruta en el mapa...',
  finding: 'Ari está buscando el contenedor...',
  findingBoat: 'Ari está localizando el contenedor por barco...',
  eta: 'Ari está calculando el ETA...',
  comparing: 'Ari está comparando los documentos...',
}

function inferThinkingType(message?: ChatMessage): ThinkingAnimationType {
  if (!message) return 'thinking'

  const hasPdf = (message.attachments ?? []).some(
    (attachment) =>
      attachment.type.toLowerCase().includes('pdf') ||
      /\.(pdf|docx?|xlsx?|csv)$/i.test(attachment.name),
  )
  if (hasPdf) return 'reading'

  const text = message.text.toLowerCase()
  const has = (...words: string[]) => words.some((word) => text.includes(word))

  if (
    has('reconcil', 'discrepan', 'compara', 'comparar', 'cruza', 'cotej', 'bill of lading', 'packing list', 'invoice')
  ) {
    return 'comparing'
  }
  if (has('barco', 'buque', 'vessel', 'naviera')) return 'findingBoat'
  if (has('contenedor', 'container')) return 'finding'
  if (has('ruta', 'mapa', 'rastrea', 'track', 'ubica', 'ubicaci', 'posici', 'dónde', 'donde')) {
    return 'mapping'
  }
  if (has('eta', 'llega', 'cuándo', 'cuando', 'tiempo', 'demora', 'retras', 'estim')) {
    return 'eta'
  }
  if (has('gráfic', 'grafic', 'métric', 'metric', 'analític', 'analitic', 'estadístic', 'chart', 'dashboard')) {
    return 'drawing'
  }
  if (has('documento', 'pdf', 'archivo', 'lee', 'leer', 'extrae', 'reporte')) {
    return 'reading'
  }
  return 'thinking'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function savedTitle(spec: JsonRenderSpec, fallback: string): string {
  for (const element of Object.values(spec.elements)) {
    const props = element.props as Record<string, unknown>
    if (typeof props?.title === 'string' && props.title.trim()) return props.title
    if (typeof props?.reference === 'string' && props.reference.trim()) {
      return props.reference
    }
  }
  const text = fallback.trim()
  if (!text) return 'Tarjeta guardada'
  return text.length > 60 ? `${text.slice(0, 57)}…` : text
}

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

function deriveTraceSteps(spec: JsonRenderSpec): TraceStep[] {
  const types = Object.values(spec.elements).map((element) => element.type)
  const hasDocuments = types.some((type) => DOCUMENT_ELEMENT_TYPES.has(type))
  const hasCustoms = types.some((type) => type.toLowerCase().includes('customs'))
  const hasRoute = types.some(
    (type) => type.toLowerCase().includes('route') || type.toLowerCase().includes('map'),
  )
  const componentNames = types
    .map((type) => ELEMENT_STEP_LABELS[type] ?? type)
    .filter((name, index, all) => all.indexOf(name) === index)

  const dataSource = hasCustoms
    ? 'Fuente: Pedimento de importación y semáforo fiscal aduanal'
    : hasRoute
      ? 'Fuente: Telemetría satelital AIS del buque'
      : 'Fuente: Detalle 360° de operaciones (Supabase)'

  const steps: TraceStep[] = [
    {
      title: 'Interpretar la solicitud',
      detail:
        'Ari analiza tu mensaje y decide qué herramientas de datos y agentes necesita.',
    },
    {
      title: 'Consultar datos operativos',
      detail:
        'Ejecuta las tools de Supabase para traer operaciones, contenedores y estados verificados en tiempo real.',
      outputSummary: dataSource,
    },
  ]

  if (hasDocuments) {
    steps.push({
      title: 'Reconciliar documentos',
      detail:
        'Delega en Recon el cruce de Bill of Lading, Commercial Invoice y Packing List para detectar discrepancias.',
      outputSummary: 'Fuente: Bill of Lading, Commercial Invoice y Packing List certificados',
    })
  }

  steps.push({
    title: 'Componer la evidencia',
    detail: `Estructura ${componentNames.length} componente${componentNames.length === 1 ? '' : 's'}: ${componentNames.join(', ')}.`,
  })
  steps.push({
    title: 'Validar y renderizar',
    detail:
      'El resultado pasa por el catálogo json-render validado antes de mostrarse en el chat.',
  })
  return steps
}

const quickPrompts = [
  {
    icon: Ship,
    label: 'Embarques',
    prompt: 'Muéstrame el estado de mis embarques activos.',
  },
  {
    icon: Package,
    label: 'Contenedores',
    prompt: 'Revisa el estado de mis contenedores en tránsito.',
  },
  {
    icon: FileText,
    label: 'Documentos',
    prompt:
      'Reconcilia el Bill of Lading, la Commercial Invoice y el Packing List.',
  },
  {
    icon: Landmark,
    label: 'Aduanas',
    prompt: 'Consulta el estado de mis trámites de aduana.',
  },
  {
    icon: AlertTriangle,
    label: 'Incidencias',
    prompt: 'Muéstrame las incidencias abiertas en mis operaciones.',
  },
  {
    icon: BarChart3,
    label: 'Analíticas',
    prompt: 'Muéstrame las analíticas y métricas de mis operaciones.',
  },
]

async function toChatAttachment(
  file: FileUIPart,
  index: number,
): Promise<ChatAttachment> {
  const response = await fetch(file.url)
  const blob = await response.blob()
  return {
    id: `${file.filename ?? 'file'}-${crypto.randomUUID()}`,
    name: file.filename ?? `Archivo ${index + 1}`,
    size: blob.size,
    type: file.mediaType || blob.type,
    url: URL.createObjectURL(blob),
  }
}

function attachmentData(attachment: ChatAttachment) {
  return {
    id: attachment.id,
    type: 'file' as const,
    filename: attachment.name,
    mediaType: attachment.type,
    url: attachment.url,
  }
}

function AriAvatar({ className = '' }: { className?: string }) {
  return (
    <span
      className={`grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ${className}`}
      aria-hidden="true"
    >
      <Sparkles className="size-4" />
    </span>
  )
}

function SentAttachments({
  attachments,
  onOpen,
}: {
  attachments: ChatAttachment[]
  onOpen: (attachment: ChatAttachment) => void
}) {
  return (
    <Attachments variant="list" className="w-full gap-2" aria-label="Archivos adjuntos">
      {attachments.map((attachment) => (
        <Attachment
          key={attachment.id}
          data={attachmentData(attachment)}
          className="w-full max-w-sm overflow-hidden p-0 hover:bg-muted/50"
        >
          <button
            type="button"
            className="flex w-full items-center gap-3 p-3 text-left"
            onClick={() => onOpen(attachment)}
          >
            <AttachmentPreview />
            <AttachmentInfo />
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatFileSize(attachment.size)}
            </span>
          </button>
        </Attachment>
      ))}
    </Attachments>
  )
}

function ComposerControls({
  connectionStatus,
  input,
  onInputChange,
  onNotify,
  submitting,
  t,
}: {
  connectionStatus: ConnectionStatus
  input: string
  onInputChange: (value: string) => void
  onNotify: (message: string) => void
  submitting: boolean
  t: ReturnType<typeof getTranslations>
}) {
  const attachments = usePromptInputAttachments()
  const previousCount = useRef(0)
  const running = connectionStatus === 'running'
  const busy = running || submitting

  useEffect(() => {
    const added = attachments.files.length - previousCount.current
    if (added > 0) {
      onNotify(
        `${added} archivo${added === 1 ? '' : 's'} adjuntado${added === 1 ? '' : 's'}`,
      )
    }
    previousCount.current = attachments.files.length
  }, [attachments.files.length, onNotify])

  return (
    <>
      {attachments.files.length > 0 && (
        <PromptInputHeader className="border-b border-border px-3 pb-2 pt-3">
          <Attachments variant="inline" className="w-full gap-2" aria-label="Archivos seleccionados">
            {attachments.files.map((file) => (
              <Attachment key={file.id} data={file} onRemove={() => attachments.remove(file.id)}>
                <AttachmentPreview />
                <AttachmentInfo />
                <AttachmentRemove
                  className="opacity-100"
                  label={`${t.remove} ${file.filename ?? ''}`.trim()}
                />
              </Attachment>
            ))}
          </Attachments>
        </PromptInputHeader>
      )}
      <PromptInputBody>
        <PromptInputTextarea
          value={input}
          disabled={busy}
          onChange={(event) => onInputChange(event.currentTarget.value)}
          placeholder={t.chatPlaceholder}
          aria-label={t.chatPlaceholder}
          className="max-h-40 min-h-11 px-3 py-3 text-sm"
          rows={1}
        />
      </PromptInputBody>
      <PromptInputFooter className="px-2 pb-2">
        <PromptInputTools>
          <PromptInputButton
            disabled={busy}
            aria-label={t.attach}
            onClick={attachments.openFileDialog}
            className="rounded-lg text-muted-foreground hover:text-primary"
          >
            <Paperclip className="size-4" />
          </PromptInputButton>
        </PromptInputTools>
        <PromptInputSubmit
          status={
            running
              ? 'streaming'
              : submitting
                ? 'submitted'
                : connectionStatus === 'error'
                  ? 'error'
                  : undefined
          }
          disabled={busy || (!input.trim() && attachments.files.length === 0)}
          aria-label={t.send}
          className="rounded-lg"
        />
      </PromptInputFooter>
    </>
  )
}

function StatusPill({
  connectionStatus,
  label,
}: {
  connectionStatus: ConnectionStatus
  label: string
}) {
  const colors = {
    connecting: 'border-border bg-muted text-muted-foreground',
    ready:
      'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    running: 'border-primary/20 bg-primary/10 text-primary',
    error: 'border-destructive/20 bg-destructive/10 text-destructive',
  }[connectionStatus]
  const dot = {
    connecting: 'bg-muted-foreground',
    ready: 'bg-emerald-500',
    running: 'animate-pulse bg-primary',
    error: 'bg-destructive',
  }[connectionStatus]

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${colors}`}
      data-testid="chat-status"
    >
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  )
}

function ChatMessageRow({
  isSaved,
  message,
  onNotify,
  onOpenAttachment,
  onOpenContext,
  onToggleSave,
  t,
}: {
  isSaved?: (id: string) => boolean
  message: ChatMessage
  onNotify: (message: string) => void
  onOpenAttachment: (attachment: ChatAttachment, sourceId: string) => void
  onOpenContext: (spec: JsonRenderSpec, sourceId: string) => void
  onToggleSave?: (entry: { id: string; title: string; spec: JsonRenderSpec }) => boolean
  t: ReturnType<typeof getTranslations>
}) {
  const assistant = message.role === 'assistant'
  const saved = isSaved?.(message.id) ?? false
  const [traceOpen, setTraceOpen] = useState(false)
  const traceSteps =
    message.traceSteps && message.traceSteps.length > 0
      ? message.traceSteps
      : message.spec
        ? deriveTraceSteps(message.spec as JsonRenderSpec)
        : []
  const hasDocSheet = Boolean(
    message.spec &&
      Object.values(message.spec.elements).some(
        (element) =>
          DOCUMENT_SHEET_TYPES.has(element.type) ||
          Boolean((element.props as Record<string, unknown> | undefined)?.url),
      ),
  )

  return (
    <Message
      from={message.role}
      className={`mx-auto w-full max-w-3xl ${assistant ? 'flex-row items-start gap-3' : 'items-end'}`}
    >
      {assistant && <AriAvatar />}
      <div className={assistant ? 'min-w-0 flex-1' : 'flex max-w-[85%] flex-col items-end'}>
        {assistant && (
          <div className="mb-1 flex min-h-6 flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Ari</span>
            {message.spec && (
              <>
                {hasDocSheet && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => onOpenContext(message.spec as JsonRenderSpec, message.id)}
                  >
                    <FileText className="size-3.5" />
                    {t.openInfo}
                  </Button>
                )}
                {onToggleSave && (
                  <Button
                    type="button"
                    variant={saved ? 'secondary' : 'outline'}
                    size="sm"
                    className="rounded-full"
                    aria-pressed={saved}
                    onClick={() => {
                      const nowSaved = onToggleSave({
                        id: message.id,
                        title: savedTitle(message.spec as JsonRenderSpec, message.text),
                        spec: message.spec as JsonRenderSpec,
                      })
                      onNotify(nowSaved ? t.saveCardDone : t.unsaveCardDone)
                    }}
                  >
                    {saved ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
                    {saved ? t.savedCardShort : t.saveCard}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
        {assistant && message.spec && traceSteps.length > 0 && (
          <div className="mb-3 w-full overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
              aria-expanded={traceOpen}
              onClick={() => setTraceOpen((current) => !current)}
            >
              <ListTree className="size-4 text-primary" />
              <span>{t.stepByStepTab}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {traceSteps.length}
              </span>
              <ChevronRight
                className={`ml-auto size-4 text-muted-foreground transition-transform ${
                  traceOpen ? 'rotate-90' : ''
                }`}
                aria-hidden="true"
              />
            </button>
            {traceOpen && (
              <div className="space-y-4 border-t border-border px-3 py-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  {t.stepByStepIntro}
                </p>
                <ol className="space-y-4">
                  {traceSteps.map((step, index) => (
                    <li key={step.title} className="relative flex gap-3">
                      {index < traceSteps.length - 1 && (
                        <span
                          className="absolute bottom-[-1rem] left-3 top-6 w-px bg-border"
                          aria-hidden="true"
                        />
                      )}
                      <span className="relative z-10 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {index + 1}
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <b className="text-sm font-medium">{step.title}</b>
                        <p className="mt-1 text-sm leading-5 text-muted-foreground">
                          {step.detail}
                        </p>
                        {step.outputSummary && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-primary">
                            <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                            <span>{step.outputSummary}</span>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
        <MessageContent
          className={
            assistant
              ? 'w-full overflow-visible'
              : 'rounded-2xl bg-muted px-4 pb-3 pt-[10px] text-foreground'
          }
          data-testid={message.spec ? 'json-render-response' : undefined}
        >
          {message.attachments && (
            <SentAttachments
              attachments={message.attachments}
              onOpen={(attachment) => onOpenAttachment(attachment, message.id)}
            />
          )}
          {message.spec ? (
            <JsonRenderClient spec={message.spec as Spec} />
          ) : assistant ? (
            <MessageResponse>{message.text}</MessageResponse>
          ) : (
            <p className="m-0 whitespace-pre-wrap text-sm leading-6">{message.text}</p>
          )}
        </MessageContent>
        {assistant && (
          <MessageActions className="mt-1 text-muted-foreground">
            <MessageAction
              label={t.copy}
              aria-label={t.copy}
              onClick={() => {
                void navigator.clipboard?.writeText(message.text)
                onNotify('Respuesta copiada')
              }}
            >
              <Copy className="size-3.5" />
            </MessageAction>
            <MessageAction
              label={t.responseRated}
              aria-label={t.responseRated}
              onClick={() => onNotify('Respuesta valorada')}
            >
              <ThumbsUp className="size-3.5" />
            </MessageAction>
            <MessageAction
              label="Marcar como poco útil"
              aria-label="Marcar como poco útil"
              onClick={() => onNotify('Gracias por tu opinión')}
            >
              <ThumbsDown className="size-3.5" />
            </MessageAction>
          </MessageActions>
        )}
      </div>
    </Message>
  )
}

const kickerClass = 'text-xs font-medium uppercase tracking-wider text-muted-foreground'

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
  const composerSubmittingRef = useRef(false)
  const [composerSubmitting, setComposerSubmitting] = useState(false)
  const { clearConversation, connectionStatus, dispatchMessage, messages } = useAriChat({
    dispatchBlocked: composerSubmitting,
    dispatchBlockedRef: composerSubmittingRef,
    locale,
    onNotify,
  })
  const [input, setInput] = useState('')
  const [composerRevision, setComposerRevision] = useState(0)
  const [agentName] = useState('Ari')
  const [contextItems, setContextItems] = useState<ContextItem[]>([])
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null)
  const [savedDocIds, setSavedDocIds] = useState<Set<string>>(new Set())
  const [savingDocId, setSavingDocId] = useState<string | null>(null)

  const shareConversation = async () => {
    const transcript = messages
      .map((message) => `${message.role === 'assistant' ? 'Ari' : 'Tú'}: ${message.text}`)
      .join('\n\n')
    if (navigator.share) {
      await navigator.share({ title: 'Conversación con Ari', text: transcript })
    } else {
      await navigator.clipboard?.writeText(transcript)
      onNotify(t.responseShare)
    }
  }

  function sendQuickPrompt(promptText: string) {
    if (composerSubmittingRef.current) return
    if (dispatchMessage(promptText, [])) {
      setInput('')
      setComposerRevision((current) => current + 1)
    }
  }

  function handleClearChat() {
    clearConversation()
    composerSubmittingRef.current = false
    setComposerSubmitting(false)
    setInput('')
    setComposerRevision((current) => current + 1)
    setContextItems([])
    setSelectedContextId(null)
    onNotify(t.newChatDone)
  }

  function openContextPanel(spec: JsonRenderSpec, sourceId: string) {
    const items = contextItemsFromSpec(spec, sourceId)
    setContextItems(items)
    setSelectedContextId(items[0]?.id ?? null)
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
  }

  function closeContextPanel() {
    setContextItems([])
    setSelectedContextId(null)
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
      .filter(
        ([, value]) =>
          typeof value === 'string' || typeof value === 'number',
      )
      .map(([key, value]) => `${key}: ${value}`)
    const content = [
      'NAUTA FREIGHT & CUSTOMS',
      item.title,
      '',
      ...scalarLines,
    ].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${item.title.replace(/\s+/g, '-').toLowerCase()}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }
  const statusLabel = {
    connecting: t.connecting,
    ready: t.connected,
    running: t.thinkingStatus,
    error: t.offline,
  }[connectionStatus]
  const empty = messages.length === 0 && connectionStatus !== 'running'
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user')
  const thinkingType = inferThinkingType(lastUserMessage)

  return (
    <div
      className={`relative grid h-full min-h-0 w-full overflow-hidden bg-background ${
        showContextPanel
          ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(380px,42%)]'
          : 'grid-cols-1'
      }`}
    >
      <section className="flex min-h-0 min-w-0 flex-col bg-background">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 sm:px-4">
          {onToggleSidebar && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              aria-label={sidebarOpen ? 'Ocultar panel' : 'Mostrar panel'}
            >
              {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
            </Button>
          )}
          <div className="mr-auto flex min-w-0 items-center gap-2.5">
            <AriAvatar className="size-8" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight">{agentName}</h1>
              <p className="truncate text-xs text-muted-foreground">Asistente de logística de Nauta</p>
            </div>
          </div>
          <StatusPill connectionStatus={connectionStatus} label={statusLabel} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearChat}
            aria-label={t.newChat}
          >
            <RotateCcw className="size-4" />
            <span className="hidden md:inline">{t.newChat}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void shareConversation()}
            aria-label={t.share}
          >
            <Share2 className="size-4" />
            <span className="hidden sm:inline">{t.share}</span>
          </Button>
        </header>

        <Conversation className="min-h-0 bg-background" aria-live="polite">
          <ConversationContent
            className={
              empty
                ? 'min-h-full justify-center p-4'
                : 'mx-auto w-full max-w-3xl gap-8 px-4 py-8'
            }
          >
            {empty ? (
              <ConversationEmptyState className="min-h-full gap-4 p-4">
                <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="size-6" />
                </span>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold tracking-tight">Hola, soy {agentName}</h2>
                  <p className="mx-auto max-w-lg text-sm leading-6 text-muted-foreground">
                    Asistente de logística de Nauta. Puedo ayudarte a consultar operaciones,
                    revisar documentos de comercio exterior y reconciliar BL, Invoice y Packing List.
                  </p>
                </div>
                <p className="text-sm font-medium">¿Qué necesitas consultar?</p>
                <Suggestions className="mx-auto mt-2 grid w-full max-w-2xl grid-cols-1 gap-3 whitespace-normal sm:grid-cols-2 lg:grid-cols-3">
                  {quickPrompts.map(({ icon: Icon, label, prompt }) => (
                    <Suggestion
                      key={label}
                      suggestion={prompt}
                      onClick={sendQuickPrompt}
                      disabled={composerSubmitting}
                      className="h-auto justify-start gap-3 rounded-xl border-border bg-card px-3 py-3 text-left text-sm shadow-xs hover:bg-muted"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </span>
                      <span className="whitespace-normal">{label}</span>
                    </Suggestion>
                  ))}
                </Suggestions>
              </ConversationEmptyState>
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessageRow
                    key={message.id}
                    message={message}
                    isSaved={isSaved}
                    onNotify={onNotify}
                    onOpenAttachment={openAttachment}
                    onOpenContext={openContextPanel}
                    onToggleSave={onToggleSave}
                    t={t}
                  />
                ))}
                {connectionStatus === 'running' && (
                  <Message from="assistant" className="mx-auto w-full max-w-3xl flex-row items-start gap-3">
                    <AriAvatar />
                    <MessageContent className="w-full flex-row items-center gap-4 rounded-xl border border-border bg-card p-4 animate-in fade-in">
                      <ThinkingAnimation type={thinkingType} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-primary" role="status">
                          {THINKING_COPY[thinkingType]}
                        </p>
                        <div className="thinking-progress mt-2">
                          <span />
                        </div>
                      </div>
                    </MessageContent>
                  </Message>
                )}
              </>
            )}
          </ConversationContent>
          <ConversationScrollButton className="bottom-3 z-10 shadow-xs" />
        </Conversation>

        <div className="shrink-0 border-t border-border bg-background pb-4 pt-3">
          <div className="mx-auto w-full max-w-3xl px-4">
            <PromptInput
              key={composerRevision}
              onSubmitCapture={(event) => {
                if (composerSubmittingRef.current) {
                  event.preventDefault()
                  event.stopPropagation()
                  return
                }
                composerSubmittingRef.current = true
                setComposerSubmitting(true)
              }}
              onSubmit={async ({ text, files }) => {
                const attachments: ChatAttachment[] = []
                try {
                  for (const [index, file] of files.entries()) {
                    attachments.push(await toChatAttachment(file, index))
                  }
                  const sent = dispatchMessage(text.trim(), attachments)
                  if (!sent) {
                    throw new Error('Message was not dispatched')
                  }
                  setInput('')
                } catch (error) {
                  attachments.forEach((attachment) =>
                    URL.revokeObjectURL(attachment.url),
                  )
                  throw error
                } finally {
                  composerSubmittingRef.current = false
                  setComposerSubmitting(false)
                }
              }}
              className="rounded-2xl bg-card shadow-xs [&_[data-slot=input-group]]:rounded-2xl [&_[data-slot=input-group]]:border-border [&_[data-slot=input-group]]:bg-card [&_[data-slot=input-group]]:shadow-xs"
            >
              <ComposerControls
                connectionStatus={connectionStatus}
                input={input}
                onInputChange={setInput}
                onNotify={onNotify}
                submitting={composerSubmitting}
                t={t}
              />
            </PromptInput>
          </div>
        </div>
      </section>

      {showContextPanel && (
        <aside className="absolute inset-y-0 right-0 z-30 flex w-full max-w-lg flex-col border-l border-border bg-background shadow-sm lg:static lg:z-auto lg:w-auto lg:max-w-none lg:shadow-none">
          <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
            <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Activity className="size-4 text-primary" />
              {t.contextualInfo}
            </span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Cerrar panel" onClick={closeContextPanel}>
              <X className="size-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex gap-2 overflow-x-auto border-b border-border p-3" role="tablist" aria-label={t.availableInfo}>
              {contextItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedContextId === item.id}
                  className={`min-w-36 rounded-xl border px-3 py-2 text-left transition-colors ${
                    selectedContextId === item.id
                      ? 'border-primary/30 bg-primary/10'
                      : 'border-border bg-card hover:bg-muted'
                  }`}
                  onClick={() => setSelectedContextId(item.id)}
                >
                  <small className={kickerClass}>{item.kind}</small>
                  <span className="mt-1 block truncate text-sm font-medium">{item.title}</span>
                </button>
              ))}
            </div>
            {selectedContext && (
              <div className="space-y-3 p-4">
                <span className={kickerClass}>{selectedContext.kind}</span>
                <h3 className="text-base font-semibold tracking-tight">{selectedContext.title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{selectedContext.description}</p>
                {selectedContext.url ? (
                  selectedContext.mimeType?.startsWith('image/') ? (
                    <img
                      className="max-h-[32rem] w-full rounded-xl border border-border bg-muted object-contain"
                      src={selectedContext.url}
                      alt={selectedContext.title}
                    />
                  ) : selectedContext.mimeType === 'application/pdf' ? (
                    <iframe
                      className="h-80 w-full rounded-xl border border-border bg-muted"
                      src={selectedContext.url}
                      title={selectedContext.title}
                    />
                  ) : (
                    <Button
                      render={<a href={selectedContext.url} target="_blank" rel="noreferrer" />}
                      variant="outline"
                      size="sm"
                    >
                      {t.viewFile}
                    </Button>
                  )
                ) : DOCUMENT_SHEET_TYPES.has(selectedContext.elementType) ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        <Sparkles className="size-3.5" />
                        {t.aiGenerated}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={savedDocIds.has(selectedContext.id) ? 'secondary' : 'outline'}
                          size="sm"
                          disabled={savedDocIds.has(selectedContext.id) || savingDocId !== null}
                          onClick={() => void saveDocToS3(selectedContext)}
                        >
                          {savedDocIds.has(selectedContext.id) ? (
                            <BookmarkCheck className="size-4" />
                          ) : (
                            <Save className="size-4" />
                          )}
                          {savedDocIds.has(selectedContext.id)
                            ? t.savedToS3
                            : savingDocId === selectedContext.id
                              ? t.savingToS3
                              : t.saveToS3}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => downloadDoc(selectedContext)}
                        >
                          <Download className="size-4" />
                          {t.downloadDoc}
                        </Button>
                      </div>
                    </div>
                    <DocumentSheetView
                      title={selectedContext.title}
                      props={selectedContext.props}
                    />
                  </div>
                ) : null}
                <small className="block text-xs text-muted-foreground">Origen: {selectedContext.sourceId}</small>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
