import type { JsonRenderSpec } from '@/lib/json-render/catalog'
import type { DashboardItemKind } from '@/lib/use-dashboard'

export type SavableComponent = {
  elementId: string
  title: string
  subtitle?: string
  kind: DashboardItemKind
  spec: JsonRenderSpec
}

// Maps each json-render component type to the dashboard bucket it belongs to.
// Types not listed fall back to a generic 'card' so nothing is silently dropped.
const KIND_BY_TYPE: Record<string, DashboardItemKind> = {
  BarChart: 'chart',
  CatalogChart: 'chart',
  InteractiveChart: 'chart',
  ContainerProgress: 'chart',
  StepProgressBar: 'chart',
  ComparisonTable: 'table',
  ReconciliationFindings: 'table',
  HumanDecisionCard: 'decision',
  KpiGrid: 'metrics',
  OperationsMetricsCard: 'metrics',
  OperationSummaryCard: 'metrics',
  OperationalAlertList: 'alert_list',
  DeliveryIssueCard: 'alert_list',
  EtaRiskCard: 'alert_list',
  InteractiveRouteMap: 'route_map',
  AgentRunTimeline: 'timeline',
  ShipmentDocumentsTimeline: 'timeline',
  ShipmentMilestoneTimeline: 'timeline',
  DeliveryCard: 'card',
  CustomsClearancePanel: 'card',
  DocumentDetailsCard: 'card',
}

// Wrapper/layout types that should never be saved as standalone widgets.
const NON_SAVABLE = new Set(['AssistantMessage'])

function kindForType(type: string): DashboardItemKind {
  return KIND_BY_TYPE[type] ?? 'card'
}

function propString(props: Record<string, unknown>, key: string): string | undefined {
  const value = props[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function titleForElement(type: string, props: Record<string, unknown>): string {
  return (
    propString(props, 'title') ??
    propString(props, 'heading') ??
    propString(props, 'reference') ??
    propString(props, 'label') ??
    propString(props, 'name') ??
    prettifyType(type)
  )
}

function prettifyType(type: string): string {
  return type.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/Card$|Panel$|List$/, '').trim() || type
}

// Collects an element and its full descendant subtree into a standalone spec so
// it can be rendered on its own inside a dashboard tile.
function subSpecFor(elementId: string, source: JsonRenderSpec): JsonRenderSpec {
  const elements: JsonRenderSpec['elements'] = {}
  const walk = (id: string) => {
    const element = source.elements[id]
    if (!element || elements[id]) return
    elements[id] = element
    for (const childId of element.children ?? []) walk(childId)
  }
  walk(elementId)
  return { root: elementId, elements }
}

/**
 * Splits an assistant chat response into individually savable components. When
 * the response is wrapped in an AssistantMessage, each top-level child becomes a
 * candidate; when the root is itself a widget, the whole spec is a single one.
 */
export function extractSavableComponents(spec: JsonRenderSpec): SavableComponent[] {
  const rootElement = spec.elements[spec.root]
  if (!rootElement) return []

  const childIds =
    rootElement.type === 'AssistantMessage'
      ? (rootElement.children ?? [])
      : [spec.root]

  const components: SavableComponent[] = []
  for (const id of childIds) {
    const element = spec.elements[id]
    if (!element || NON_SAVABLE.has(element.type)) continue
    const props = (element.props ?? {}) as Record<string, unknown>
    components.push({
      elementId: id,
      title: titleForElement(element.type, props),
      subtitle: propString(props, 'subtitle') ?? propString(props, 'description'),
      kind: kindForType(element.type),
      spec: subSpecFor(id, spec),
    })
  }
  return components
}

// Title for saving an entire response as one dashboard item.
export function fullResultTitle(spec: JsonRenderSpec, fallback: string): string {
  const components = extractSavableComponents(spec)
  if (components.length > 0) {
    return components.length === 1 ? components[0].title : `${components[0].title} +${components.length - 1}`
  }
  const text = fallback.trim()
  if (!text) return 'Saved result'
  return text.length > 60 ? `${text.slice(0, 57)}…` : text
}
