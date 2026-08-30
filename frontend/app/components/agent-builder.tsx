'use client'

import type { Spec } from '@json-render/core'
import type { FileUIPart } from 'ai'
import {
  AlertTriangle,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  BookmarkPlus,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Landmark,
  MessageSquare,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Rocket,
  RotateCcw,
  Save,
  Settings,
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
import { Spinner } from '@/components/ui/spinner'
import { WorkTraceDisclosure } from '@/components/chat/work-trace'
import { DocumentSheetView } from '@/components/logistics/document-sheet-view'
import { JsonRenderClient } from '@/app/json-render/render-client'
import { getBackendUrl } from '@/lib/backend-url'
import { getTranslations, type Locale } from '@/lib/i18n'
import type { JsonRenderSpec } from '@/lib/json-render/catalog'
import { extractSavableComponents, fullResultTitle } from '@/lib/dashboard-extract'
import type { DashboardItemKind, SaveDashboardInput } from '@/lib/use-dashboard'
import {
  closePaneTabState,
  keyboardPaneTabTarget,
} from '@/lib/pane-tabs'
import {
  type ChatAttachment,
  type ChatMessage,
  type ConnectionStatus,
  useAriChat,
} from '@/lib/use-ari-chat'

type CatalogPaneTab = {
  id: string
  title: string
  kind: 'catalog'
  category: 'Documento' | 'Informe' | 'Detalle'
  description: string
  sourceId: string
  elementType: string
  props: Record<string, unknown>
  url?: string
  mimeType?: string
}

type CustomReportPaneTab = {
  id: string
  kind: 'custom-report'
  title: string
  artifactId: string
  revisionId: string
  previewUrl: string
  status: 'accepted'
}

type PaneTab = CatalogPaneTab | CustomReportPaneTab

type ReportArtifactResponse = Omit<CustomReportPaneTab, 'id'> & {
  createdAt: string
}

const DOCUMENT_SHEET_TYPES = new Set([
  'DocumentDetailsCard',
  'CustomsClearancePanel',
  'ShipmentDocumentsTimeline',
])

function paneTabsFromSpec(
  spec: JsonRenderSpec,
  sourceId: string,
): CatalogPaneTab[] {
  return Object.entries(spec.elements).map(([id, element], index) => {
    const props = element.props as Record<string, unknown>
    const kind = element.type.toLowerCase().includes('issue')
      ? 'Informe'
      : element.type.toLowerCase().includes('document')
        ? 'Documento'
        : 'Detalle'
    const title =
      typeof props.title === 'string'
        ? props.title
        : typeof props.reference === 'string'
          ? props.reference
          : `${kind} ${index + 1}`
    const url =
      typeof props.url === 'string'
        ? props.url
        : typeof props.fileUrl === 'string'
          ? props.fileUrl
          : undefined

    return {
      id: `${sourceId}-${id}`,
      title,
      kind: 'catalog',
      category: kind,
      description:
        typeof props.description === 'string'
          ? props.description
          : `Información contextual de ${title.toLowerCase()}.`,
      sourceId,
      elementType: element.type,
      props,
      url,
      mimeType:
        typeof props.mimeType === 'string' ? props.mimeType : undefined,
    }
  })
}

function isAcceptedReportArtifact(value: unknown): value is ReportArtifactResponse {
  if (!value || typeof value !== 'object') return false
  const artifact = value as Partial<ReportArtifactResponse>
  return (
    artifact.kind === 'custom-report' &&
    artifact.status === 'accepted' &&
    typeof artifact.artifactId === 'string' &&
    typeof artifact.revisionId === 'string' &&
    typeof artifact.title === 'string' &&
    typeof artifact.previewUrl === 'string' &&
    typeof artifact.createdAt === 'string'
  )
}

function assertUnreachable(value: never): never {
  throw new Error(`Unsupported pane tab: ${JSON.stringify(value)}`)
}

const backendUrl = getBackendUrl()

const fixedInstructions = `You are Ari, the lead logistics agent.

Ground operational answers in the live Supabase query tools. Delegate Bill of Lading, Commercial Invoice, and Packing List reconciliation to Recon.

Return client-friendly explanations and preserve validated structured tool results so the backend can compose evidence-backed json-render components.`

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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

function SavableComponentCard({
  component,
  isSaved,
  onSaveComponent,
  onNotify,
  t,
}: {
  component: ReturnType<typeof extractSavableComponents>[number]
  isSaved?: (title: string, kind?: DashboardItemKind) => boolean
  onSaveComponent?: (input: SaveDashboardInput) => boolean
  onNotify: (message: string) => void
  t: ReturnType<typeof getTranslations>
}) {
  const saved = isSaved?.(component.title, component.kind) ?? false
  return (
    <div className="group/savable relative w-full">
      {onSaveComponent && (
        <button
          type="button"
          className={`absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full border border-border bg-card/90 px-2 py-1 text-xs font-medium shadow-xs backdrop-blur transition-opacity hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 group-hover/savable:opacity-100 ${
            saved ? 'text-primary opacity-100' : 'text-muted-foreground opacity-0'
          }`}
          aria-pressed={saved}
          onClick={() => {
            const nowSaved = onSaveComponent({
              title: component.title,
              kind: component.kind,
              payload: component.spec,
              subtitle: component.subtitle,
            })
            onNotify(nowSaved ? t.saveToDashboardDone : t.removeFromDashboardDone)
          }}
        >
          {saved ? <BookmarkCheck className="size-3.5" /> : <BookmarkPlus className="size-3.5" />}
          {saved ? t.savedResult : t.saveToDashboard}
        </button>
      )}
      <JsonRenderClient spec={component.spec as Spec} />
    </div>
  )
}

function SavableResponse({
  spec,
  isSaved,
  onSaveComponent,
  onNotify,
  t,
}: {
  spec: JsonRenderSpec
  isSaved?: (title: string, kind?: DashboardItemKind) => boolean
  onSaveComponent?: (input: SaveDashboardInput) => boolean
  onNotify: (message: string) => void
  t: ReturnType<typeof getTranslations>
}) {
  const rootElement = spec.elements[spec.root]
  const components = extractSavableComponents(spec)

  // When the reply is wrapped in an AssistantMessage, mirror its layout (intro
  // text, then a spaced stack) so a save control can sit on each rendered block
  // without changing the visual result.
  if (rootElement?.type === 'AssistantMessage') {
    const text = (rootElement.props as { text?: string }).text ?? ''
    return (
      <div className="w-full text-foreground">
        {text && <p className="text-sm leading-relaxed text-foreground">{text}</p>}
        {components.length > 0 && (
          <div className="mt-4 w-full space-y-4">
            {components.map((component) => (
              <SavableComponentCard
                key={component.elementId}
                component={component}
                isSaved={isSaved}
                onSaveComponent={onSaveComponent}
                onNotify={onNotify}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Root is itself a rendered widget (e.g. a lone chart): one savable card.
  if (components.length === 1) {
    return (
      <SavableComponentCard
        component={components[0]}
        isSaved={isSaved}
        onSaveComponent={onSaveComponent}
        onNotify={onNotify}
        t={t}
      />
    )
  }

  return <JsonRenderClient spec={spec as Spec} />
}

function ChatMessageRow({
  isSaved,
  message,
  onNotify,
  onOpenAttachment,
  onOpenContext,
  onSaveComponent,
  t,
}: {
  isSaved?: (title: string, kind?: DashboardItemKind) => boolean
  message: ChatMessage
  onNotify: (message: string) => void
  onOpenAttachment: (attachment: ChatAttachment, sourceId: string) => void
  onOpenContext: (spec: JsonRenderSpec, sourceId: string) => void
  onSaveComponent?: (input: SaveDashboardInput) => boolean
  t: ReturnType<typeof getTranslations>
}) {
  const assistant = message.role === 'assistant'
  const fullTitle = message.spec ? fullResultTitle(message.spec as JsonRenderSpec, message.text) : ''
  const saved = isSaved?.(fullTitle, 'full_spec') ?? false

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
                {onSaveComponent && (
                  <Button
                    type="button"
                    variant={saved ? 'secondary' : 'outline'}
                    size="sm"
                    className="rounded-full"
                    aria-pressed={saved}
                    onClick={() => {
                      const nowSaved = onSaveComponent({
                        title: fullTitle,
                        kind: 'full_spec',
                        payload: message.spec as JsonRenderSpec,
                        subtitle: 'Full result',
                      })
                      onNotify(nowSaved ? t.saveCardDone : t.unsaveCardDone)
                    }}
                  >
                    {saved ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
                    {saved ? t.savedCardShort : t.saveResult}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
        {assistant && message.workTrace && (
          <WorkTraceDisclosure
            trace={message.workTrace}
            workedForLabel={t.workedFor}
            workingLabel={t.thinkingStatus}
          />
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
            <SavableResponse
              spec={message.spec as JsonRenderSpec}
              isSaved={isSaved}
              onSaveComponent={onSaveComponent}
              onNotify={onNotify}
              t={t}
            />
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

const fieldClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-2 focus:ring-ring/20'
const kickerClass = 'text-xs font-medium uppercase tracking-wider text-muted-foreground'

export default function AgentBuilderView({
  onNotify,
  locale = 'es',
  sidebarOpen = true,
  onToggleSidebar,
  isSaved,
  onSaveComponent,
}: {
  onNotify: (message: string) => void
  locale?: Locale
  sidebarOpen?: boolean
  onToggleSidebar?: () => void
  isSaved?: (title: string, kind?: DashboardItemKind) => boolean
  onSaveComponent?: (input: SaveDashboardInput) => boolean
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
  const [tab, setTab] = useState('Test Agent')
  const [input, setInput] = useState('')
  const [composerRevision, setComposerRevision] = useState(0)
  const [agentName, setAgentName] = useState('Ari')
  const [language, setLanguage] = useState('Español')
  const [purpose, setPurpose] = useState('Asistente general')
  const [company, setCompany] = useState('Muebles del Sur')
  const [companyDesc, setCompanyDesc] = useState('Empresa de distribución y logística')
  const [saved, setSaved] = useState(false)
  const [paneTabs, setPaneTabs] = useState<PaneTab[]>([])
  const [selectedPaneTabId, setSelectedPaneTabId] = useState<string | null>(null)
  const paneTabButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const [reportGenerationStatus, setReportGenerationStatus] = useState<'idle' | 'pending' | 'error'>('idle')
  const [reportGenerationError, setReportGenerationError] = useState<string | null>(null)
  const reportRequestRef = useRef<{ prompt: string; requestId: string } | null>(null)
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

  function save() {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
    onNotify('Configuración del tracer guardada')
  }

  function handleClearChat() {
    clearConversation()
    composerSubmittingRef.current = false
    setComposerSubmitting(false)
    setInput('')
    setComposerRevision((current) => current + 1)
    setPaneTabs([])
    setSelectedPaneTabId(null)
    setReportGenerationStatus('idle')
    setReportGenerationError(null)
    reportRequestRef.current = null
    onNotify(t.newChatDone)
  }

  function openContextPanel(spec: JsonRenderSpec, sourceId: string) {
    const tabs = paneTabsFromSpec(spec, sourceId)
    setPaneTabs((current) => [
      ...current.filter((existing) => !tabs.some((tab) => tab.id === existing.id)),
      ...tabs,
    ])
    setSelectedPaneTabId(tabs[0]?.id ?? null)
  }

  function openAttachment(attachment: ChatAttachment, sourceId: string) {
    const item: CatalogPaneTab = {
      id: `${sourceId}-${attachment.id}`,
      title: attachment.name,
      kind: 'catalog',
      category: 'Documento',
      description: `Vista previa de ${attachment.name}.`,
      sourceId,
      elementType: 'Attachment',
      props: {},
      url: attachment.url,
      mimeType: attachment.type,
    }
    setPaneTabs((current) => [
      ...current.filter((existing) => existing.id !== item.id),
      item,
    ])
    setSelectedPaneTabId(item.id)
  }

  function closeContextPanel() {
    setPaneTabs([])
    setSelectedPaneTabId(null)
  }

  function closePaneTab(id: string) {
    setPaneTabs((current) => {
      const next = closePaneTabState(
        current.map((tab) => tab.id),
        selectedPaneTabId,
        id,
      )
      setSelectedPaneTabId(next.selectedId)
      return current.filter((tab) => next.remainingIds.includes(tab.id))
    })
  }

  function focusPaneTab(id: string) {
    setSelectedPaneTabId(id)
    window.requestAnimationFrame(() => {
      paneTabButtonRefs.current.get(id)?.focus()
      paneTabButtonRefs.current.get(id)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      })
    })
  }

  function paneTabDomId(id: string) {
    return encodeURIComponent(id).replaceAll('%', '-')
  }

  async function generateCustomReport() {
    if (reportGenerationStatus === 'pending') return
    const latestUserPrompt = [...messages]
      .reverse()
      .find((message) => message.role === 'user')
      ?.text.trim()
    const prompt = (latestUserPrompt || t.customReportDefaultPrompt).slice(0, 1_200)
    const previousRequest = reportRequestRef.current
    const requestId =
      previousRequest?.prompt === prompt
        ? previousRequest.requestId
        : crypto.randomUUID()
    reportRequestRef.current = { prompt, requestId }
    setReportGenerationStatus('pending')
    setReportGenerationError(null)

    try {
      const response = await fetch(`${backendUrl}/api/demo/artifacts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, prompt }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = (await response.json()) as { artifact?: unknown }
      if (!isAcceptedReportArtifact(payload.artifact)) {
        throw new Error('Invalid accepted report descriptor')
      }
      const artifact = payload.artifact
      const reportTab: CustomReportPaneTab = {
        id: `custom-report-${artifact.artifactId}-${artifact.revisionId}`,
        kind: artifact.kind,
        title: artifact.title,
        artifactId: artifact.artifactId,
        revisionId: artifact.revisionId,
        previewUrl: artifact.previewUrl,
        status: artifact.status,
      }
      setPaneTabs((current) => [
        ...current.filter((tab) => tab.id !== reportTab.id),
        reportTab,
      ])
      setSelectedPaneTabId(reportTab.id)
      setReportGenerationStatus('idle')
      reportRequestRef.current = null
      onNotify(t.customReportReady)
    } catch (error) {
      console.error('[report-generation] Could not generate custom report:', error)
      setReportGenerationStatus('error')
      setReportGenerationError(t.customReportError)
      onNotify(t.customReportError)
    }
  }

  const selectedPaneTab = paneTabs.find((item) => item.id === selectedPaneTabId)
  const showContextPanel = paneTabs.length > 0
  async function saveDocToS3(item: CatalogPaneTab) {
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

  function downloadDoc(item: CatalogPaneTab) {
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
            variant="outline"
            size="sm"
            disabled={reportGenerationStatus === 'pending'}
            onClick={() => void generateCustomReport()}
            aria-label={t.generateCustomReport}
          >
            {reportGenerationStatus === 'pending' ? (
              <Spinner className="size-4 text-primary" />
            ) : (
              <BarChart3 className="size-4" />
            )}
            <span className="hidden sm:inline">
              {reportGenerationStatus === 'pending'
                ? t.generatingCustomReport
                : t.generateCustomReport}
            </span>
          </Button>
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

        {reportGenerationError && (
          <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert">
            {reportGenerationError}
          </div>
        )}

        <Conversation className="min-h-0 bg-background">
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
                    key={message.renderKey ?? message.id}
                    message={message}
                    isSaved={isSaved}
                    onNotify={onNotify}
                    onOpenAttachment={openAttachment}
                    onOpenContext={openContextPanel}
                    onSaveComponent={onSaveComponent}
                    t={t}
                  />
                ))}
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
          <div className="flex h-14 shrink-0 items-stretch border-b border-border bg-muted/40">
            <div
              className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap px-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label={t.availableInfo}
              aria-orientation="horizontal"
            >
              {paneTabs.map((item) => {
                const selected = selectedPaneTabId === item.id
                const domId = paneTabDomId(item.id)
                const tabId = `pane-tab-${domId}`
                const panelId = `pane-panel-${domId}`
                return (
                  <div
                    key={item.id}
                    role="presentation"
                    title={item.kind === 'catalog' ? item.category : t.customReportTab}
                    className={`group flex h-8 min-w-24 max-w-[220px] shrink-0 items-center gap-0.5 rounded-t-md border border-b-0 transition-colors ${
                      selected
                        ? 'border-border bg-background text-foreground shadow-[inset_0_-2px_0_0_var(--primary)]'
                        : 'border-transparent text-muted-foreground hover:border-border/70 hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <button
                      ref={(element) => {
                        if (element) paneTabButtonRefs.current.set(item.id, element)
                        else paneTabButtonRefs.current.delete(item.id)
                      }}
                      id={tabId}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls={panelId}
                      tabIndex={selected ? 0 : -1}
                      className="flex h-full min-w-0 flex-1 items-center gap-1.5 px-2 text-left text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                      onClick={() => focusPaneTab(item.id)}
                      onAuxClick={(event) => {
                        if (event.button === 1) closePaneTab(item.id)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Delete' || event.key === 'Backspace') {
                          event.preventDefault()
                          const next = closePaneTabState(
                            paneTabs.map((tab) => tab.id),
                            selectedPaneTabId,
                            item.id,
                          )
                          closePaneTab(item.id)
                          if (next.selectedId) focusPaneTab(next.selectedId)
                          return
                        }
                        const target = keyboardPaneTabTarget(
                          paneTabs.map((tab) => tab.id),
                          item.id,
                          event.key,
                        )
                        if (target) {
                          event.preventDefault()
                          focusPaneTab(target)
                        }
                      }}
                    >
                      {item.kind === 'custom-report' ? (
                        <BarChart3 className="size-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span className="truncate">{item.title}</span>
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      className={`mr-1 grid size-5 shrink-0 place-items-center rounded text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary ${
                        selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                      }`}
                      aria-label={`${t.close}: ${item.title}`}
                      onClick={() => closePaneTab(item.id)}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                )
              })}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="mx-2 self-center"
              aria-label={t.close}
              onClick={closeContextPanel}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {selectedPaneTab && (
              selectedPaneTab.kind === 'custom-report' ? (
                <div
                  id={`pane-panel-${paneTabDomId(selectedPaneTab.id)}`}
                  role="tabpanel"
                  aria-labelledby={`pane-tab-${paneTabDomId(selectedPaneTab.id)}`}
                  className="h-[calc(100dvh-3.5rem)] min-h-[32rem] bg-background"
                >
                  <iframe
                    className="h-full min-h-[32rem] w-full border-0 bg-white"
                    src={selectedPaneTab.previewUrl}
                    title={selectedPaneTab.title}
                    sandbox="allow-scripts"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : selectedPaneTab.kind === 'catalog' ? (
              <div
                id={`pane-panel-${paneTabDomId(selectedPaneTab.id)}`}
                role="tabpanel"
                aria-labelledby={`pane-tab-${paneTabDomId(selectedPaneTab.id)}`}
                className="space-y-3 p-4"
              >
                <span className={kickerClass}>{selectedPaneTab.category}</span>
                <h3 className="text-base font-semibold tracking-tight">{selectedPaneTab.title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{selectedPaneTab.description}</p>
                {selectedPaneTab.url ? (
                  selectedPaneTab.mimeType?.startsWith('image/') ? (
                    <img
                      className="max-h-[32rem] w-full rounded-xl border border-border bg-muted object-contain"
                      src={selectedPaneTab.url}
                      alt={selectedPaneTab.title}
                    />
                  ) : selectedPaneTab.mimeType === 'application/pdf' ? (
                    <iframe
                      className="h-80 w-full rounded-xl border border-border bg-muted"
                      src={selectedPaneTab.url}
                      title={selectedPaneTab.title}
                    />
                  ) : (
                    <Button
                      render={<a href={selectedPaneTab.url} target="_blank" rel="noreferrer" />}
                      variant="outline"
                      size="sm"
                    >
                      {t.viewFile}
                    </Button>
                  )
                ) : DOCUMENT_SHEET_TYPES.has(selectedPaneTab.elementType) ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        <Sparkles className="size-3.5" />
                        {t.aiGenerated}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={savedDocIds.has(selectedPaneTab.id) ? 'secondary' : 'outline'}
                          size="sm"
                          disabled={savedDocIds.has(selectedPaneTab.id) || savingDocId !== null}
                          onClick={() => void saveDocToS3(selectedPaneTab)}
                        >
                          {savedDocIds.has(selectedPaneTab.id) ? (
                            <BookmarkCheck className="size-4" />
                          ) : (
                            <Save className="size-4" />
                          )}
                          {savedDocIds.has(selectedPaneTab.id)
                            ? t.savedToS3
                            : savingDocId === selectedPaneTab.id
                              ? t.savingToS3
                              : t.saveToS3}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => downloadDoc(selectedPaneTab)}
                        >
                          <Download className="size-4" />
                          {t.downloadDoc}
                        </Button>
                      </div>
                    </div>
                    <DocumentSheetView
                      title={selectedPaneTab.title}
                      props={selectedPaneTab.props}
                    />
                  </div>
                ) : null}
                <small className="block text-xs text-muted-foreground">Origen: {selectedPaneTab.sourceId}</small>
              </div>
              ) : assertUnreachable(selectedPaneTab)
            )}

            <section className="space-y-4 border-t border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold tracking-tight">{agentName}</h3>
                  <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Tracer activo
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={save}>
                    {saved ? <CheckCircle2 className="size-4" /> : <Save className="size-4" />}
                    {saved ? 'Guardado' : 'Guardar'}
                  </Button>
                  <Button type="button" size="sm" onClick={() => onNotify('El tracer ya está activo')}>
                    <Rocket className="size-4" /> Activo
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                {['Test Agent', 'Settings', 'Instructions'].map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                      tab === item
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setTab(item)}
                  >
                    {item === 'Test Agent' && <MessageSquare className="size-3.5 shrink-0" />}
                    {item === 'Settings' && <Settings className="size-3.5 shrink-0" />}
                    {item === 'Instructions' && <FileText className="size-3.5 shrink-0" />}
                    <span className="truncate">{item}</span>
                  </button>
                ))}
              </div>

              {tab === 'Test Agent' && (
                <div className="space-y-3">
                  <p className="text-sm leading-6 text-muted-foreground">
                    Conversa con Ari. Cada turno cruza Mastra, RunCoordinator, Socket.IO y el renderer validado por catálogo.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      ['Modelo activo', 'GPT-5 mini'],
                      ['Idioma', language],
                      ['Salida', 'Recon → json-render'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-border bg-card p-3">
                        <span className={kickerClass}>{label}</span>
                        <b className="mt-1 block text-sm font-medium">{value}</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'Settings' && (
                <div className="space-y-3">
                  <label className="block space-y-1.5">
                    <span className={kickerClass}>Language</span>
                    <select className={fieldClass} value={language} onChange={(event) => setLanguage(event.target.value)}>
                      <option>Español</option>
                      <option>Inglés</option>
                      <option>Francés</option>
                      <option>Portugués</option>
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className={kickerClass}>Agent Name</span>
                    <input className={fieldClass} value={agentName} onChange={(event) => setAgentName(event.target.value)} />
                  </label>
                  <label className="block space-y-1.5">
                    <span className={kickerClass}>Agent Purpose</span>
                    <select className={fieldClass} value={purpose} onChange={(event) => setPurpose(event.target.value)}>
                      <option>Asistente general</option>
                      <option>Atención al cliente</option>
                      <option>Soporte técnico</option>
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className={kickerClass}>Company Name</span>
                    <input className={fieldClass} value={company} onChange={(event) => setCompany(event.target.value)} />
                  </label>
                  <label className="block space-y-1.5">
                    <span className={kickerClass}>Company Description</span>
                    <textarea
                      className={`${fieldClass} min-h-24 resize-y`}
                      value={companyDesc}
                      onChange={(event) => setCompanyDesc(event.target.value)}
                    />
                  </label>
                </div>
              )}

              {tab === 'Instructions' && (
                <div className="space-y-3">
                  <label className="block space-y-1.5">
                    <span className={kickerClass}>Fixed system instructions</span>
                    <textarea className={`${fieldClass} min-h-44 resize-y`} value={fixedInstructions} readOnly />
                  </label>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <label className="block space-y-1.5">
                      <span className={kickerClass}>Model</span>
                      <input className={fieldClass} value="GPT-5.6 Luna · main: medium · Recon: none" readOnly />
                    </label>
                    <small className="mt-2 block text-xs leading-5 text-muted-foreground">
                      Ari supplies the answer. The render tool supplies the fixed, catalog-valid component tree.
                    </small>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border bg-card p-4">
                <h4 className="text-base font-semibold tracking-tight">Tracer contract</h4>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Ari → Recon → reconcileShipmentDocumentsTool → renderDemoTool. Recon alone owns the reconciliation
                  capability; rendered component names and props remain catalog-validated.
                </p>
              </div>
            </section>
          </div>
        </aside>
      )}
    </div>
  )
}
