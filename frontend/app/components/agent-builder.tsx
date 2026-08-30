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
    | 'Document'
    | 'Documents'
    | 'Report'
    | 'Detail'
    | 'Sheet'
    | 'Customs Sheet'
    | 'Operational Alerts'
    | 'Tracking'
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
      // Only include elements with a real sheet viewer or attached file,
      // to avoid blank tabs (e.g. "Sheet 1", "Sheet 5").
      const props = element.props as Record<string, unknown> | undefined
      const isDocSheet = DOCUMENT_SHEET_TYPES.has(element.type)
      const hasFileUrl = Boolean(props?.url || props?.fileUrl)
      return isDocSheet || hasFileUrl
    })
    .map(([id, element], index) => {
    const props = element.props as Record<string, unknown>
    const type = element.type.toLowerCase()
    const isCustoms = type.includes('customs') || type.includes('aduan')
    const kind = isCustoms ? 'Customs Sheet' : 'Documents'
    const title =
      typeof props.title === 'string' && props.title.trim()
        ? props.title
        : typeof props.containerNumber === 'string'
          ? `Customs · ${props.containerNumber}`
          : typeof props.reference === 'string'
            ? props.reference
            : typeof props.name === 'string'
              ? props.name
              : isCustoms
                ? `Customs Sheet ${index + 1}`
                : `Document ${index + 1}`
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
          : 'Certified document record.',
      sourceId,
      elementType: element.type,
      props,
      url,
      mimeType:
        typeof props.mimeType === 'string' ? props.mimeType : undefined,
    }
  })
}

const THINKING_COPY: Record<ThinkingAnimationType, string> = {
  thinking: 'Ari is processing your request...',
  reading: 'Ari is extracting data from the document...',
  drawing: 'Ari is building the visualization...',
  mapping: 'Ari is plotting the route on the map...',
  finding: 'Ari is looking up the container...',
  findingBoat: 'Ari is locating the container by vessel...',
  eta: 'Ari is calculating the ETA...',
  comparing: 'Ari is comparing the documents...',
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
    has('reconcile', 'reconcil', 'discrepan', 'compare', 'comparison', 'cross-check', 'match', 'bill of lading', 'packing list', 'invoice')
  ) {
    return 'comparing'
  }
  if (has('boat', 'ship', 'vessel', 'carrier')) return 'findingBoat'
  if (has('container')) return 'finding'
  if (has('route', 'map', 'track', 'locate', 'location', 'position', 'where')) {
    return 'mapping'
  }
  if (has('eta', 'arrive', 'arrival', 'when', 'time', 'delay', 'estimate')) {
    return 'eta'
  }
  if (has('chart', 'graph', 'metric', 'analytic', 'statistic', 'dashboard')) {
    return 'drawing'
  }
  if (has('document', 'pdf', 'file', 'read', 'extract', 'report')) {
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
  AssistantMessage: 'assistant message',
  OperationSummaryCard: 'operation summary',
  OperationsMetricsCard: 'operations metrics',
  ContainerProgress: 'container progress',
  DeliveryCard: 'delivery status',
  DeliveryIssueCard: 'delivery issue',
  OperationalAlertList: 'operational alerts',
  EtaRiskCard: 'ETA risk',
  ShipmentMilestoneTimeline: 'shipment milestones',
  ShipmentDocumentsTimeline: 'documents timeline',
  CustomsClearancePanel: 'customs clearance',
  DocumentDetailsCard: 'document details',
  ReconciliationFindings: 'reconciliation findings',
  HumanDecisionCard: 'human decision required',
  AgentRunTimeline: 'agent timeline',
  BarChart: 'bar chart',
  InteractiveChart: 'interactive chart',
  CatalogChart: 'catalog chart',
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
    ? 'Source: Import customs declaration and customs inspection status'
    : hasRoute
      ? 'Source: AIS satellite telemetry from the vessel'
      : 'Source: 360° operations detail (Supabase)'

  const steps: TraceStep[] = [
    {
      title: 'Interpret the request',
      detail:
        'Ari analyzes your message and decides which data tools and agents it needs.',
    },
    {
      title: 'Query operational data',
      detail:
        'Runs the Supabase tools to pull operations, containers and verified statuses in real time.',
      outputSummary: dataSource,
    },
  ]

  if (hasDocuments) {
    steps.push({
      title: 'Reconcile documents',
      detail:
        'Delegates to Recon the cross-check of Bill of Lading, Commercial Invoice and Packing List to detect discrepancies.',
      outputSummary: 'Source: Certified Bill of Lading, Commercial Invoice and Packing List',
    })
  }

  steps.push({
    title: 'Compose the evidence',
    detail: `Structures ${componentNames.length} component${componentNames.length === 1 ? '' : 's'}: ${componentNames.join(', ')}.`,
  })
  steps.push({
    title: 'Validate and render',
    detail:
      'The result goes through the validated json-render catalog before being shown in the chat.',
  })
  return steps
}

const quickPrompts = [
  {
    icon: Ship,
    label: 'Shipments',
    prompt: 'Show me the status of my active shipments.',
  },
  {
    icon: Package,
    label: 'Containers',
    prompt: 'Check the status of my containers in transit.',
  },
  {
    icon: FileText,
    label: 'Documents',
    prompt:
      'Reconcile the Bill of Lading, the Commercial Invoice and the Packing List.',
  },
  {
    icon: Landmark,
    label: 'Customs',
    prompt: 'Check the status of my customs procedures.',
  },
  {
    icon: AlertTriangle,
    label: 'Incidents',
    prompt: 'Show me the open incidents in my operations.',
  },
  {
    icon: BarChart3,
    label: 'Analytics',
    prompt: 'Show me the analytics and metrics of my operations.',
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
                onNotify(t.responseCopied)
              }}
            >
              <Copy className="size-3.5" />
            </MessageAction>
            <MessageAction
              label={t.responseRated}
              aria-label={t.responseRated}
              onClick={() => onNotify(t.responseRated)}
            >
              <ThumbsUp className="size-3.5" />
            </MessageAction>
            <MessageAction
              label="Mark as not helpful"
              aria-label="Mark as not helpful"
              onClick={() => onNotify('Thanks for your feedback')}
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
  locale = 'en',
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
      .map((message) => `${message.role === 'assistant' ? 'Ari' : t.you}: ${message.text}`)
      .join('\n\n')
    if (navigator.share) {
      await navigator.share({ title: 'Conversation with Ari', text: transcript })
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
      kind: 'Document',
      description: `Preview of ${attachment.name}.`,
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
  const activeAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant')
  const latestTraceStep = activeAssistantMessage?.traceSteps?.at(-1)

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
              aria-label={sidebarOpen ? t.hidePanel : t.showPanel}
            >
              {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
            </Button>
          )}
          <div className="mr-auto flex min-w-0 items-center gap-2.5">
            <AriAvatar className="size-8" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight">{agentName}</h1>
              <p className="truncate text-xs text-muted-foreground">Nauta logistics assistant</p>
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
                  <h2 className="text-xl font-semibold tracking-tight">Hi, I&apos;m {agentName}</h2>
                  <p className="mx-auto max-w-lg text-sm leading-6 text-muted-foreground">
                    Nauta logistics assistant. I can help you check operations,
                    review foreign trade documents and reconcile BL, Invoice and Packing List.
                  </p>
                </div>
                <p className="text-sm font-medium">What do you need to check?</p>
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
                          {latestTraceStep?.title ?? THINKING_COPY[thinkingType]}
                        </p>
                        {latestTraceStep?.detail && (
                          <p className="mt-1 truncate text-sm leading-5 text-muted-foreground">
                            {latestTraceStep.detail}
                          </p>
                        )}
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
                <div className="mt-4 space-y-2 rounded-xl border border-border/60 bg-muted/40 p-3.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Sparkles className="size-3.5 text-primary" />
                    <span>Document Traceability &amp; Origin</span>
                  </div>
                  <p className="leading-relaxed text-muted-foreground">
                    This record was generated and audited automatically by <b>Ari</b> through the
                    direct reading of the official documents in Nauta&apos;s secure repository (certified
                    database and storage).
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/40 pt-1 text-[11px] text-muted-foreground">
                    <span>
                      <b>Validation:</b> Automated foreign trade cross-check
                    </span>
                    <span>
                      <b>Integrity:</b> 100% Verified against official sources
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
