'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { getTranslations } from '@/lib/i18n'
import { useOrderIncidents } from '@/lib/use-order-incidents'
import { useDashboard, type DashboardItemKind } from '@/lib/use-dashboard'
import { JsonRenderClient } from '@/app/json-render/render-client'
import type { Spec } from '@json-render/core'
import nextDynamic from 'next/dynamic'
import type { OrderIncident } from '../../backend/src/contracts/order-incident'
import {
  Activity,
  BarChart3,
  Bell,
  ChevronRight,
  CircleHelp,
  Gauge,
  GripVertical,
  Layers,
  LayoutDashboard,
  ListChecks,
  MapPinned,
  Maximize2,
  Menu,
  MessageCircle,
  Minimize2,
  Moon,
  MoreHorizontal,
  Newspaper,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  Table2,
  Trash2,
  Zap,
} from 'lucide-react'

const OperationsMapView = nextDynamic(() => import('@/app/components/operations-map'), { ssr: false })
const AgentBuilderView = nextDynamic(() => import('@/app/components/agent-builder'), { ssr: false })

const navItems = [
  { key: 'issues', icon: ShieldAlert },
  { key: 'map', icon: MapPinned },
]

function DashboardsView({
  dashboard,
  onNotify,
  onGoToChat,
  t,
}: {
  dashboard: ReturnType<typeof useDashboard>
  onNotify: (message: string) => void
  onGoToChat: () => void
  t: ReturnType<typeof getTranslations>
}) {
  const { items, deleteItem } = dashboard
  const [filter, setFilter] = useState<'all' | DashboardItemKind>('all')
  const [search, setSearch] = useState('')
  const [expandedItem, setExpandedItem] = useState<DashboardItem | null>(null)

  const filters: Array<{ key: 'all' | DashboardItemKind; label: string; icon: typeof Layers }> = [
    { key: 'all', label: t.filterAll, icon: Layers },
    { key: 'full_spec', label: t.filterResults, icon: LayoutDashboard },
    { key: 'chart', label: t.filterCharts, icon: BarChart3 },
    { key: 'decision', label: t.filterDecisions, icon: ListChecks },
    { key: 'table', label: t.filterTables, icon: Table2 },
    { key: 'metrics', label: t.filterMetrics, icon: Gauge },
    { key: 'alert_list', label: t.filterAlerts, icon: Bell },
    { key: 'route_map', label: t.filterMaps, icon: MapPinned },
    { key: 'card', label: 'Others', icon: MoreHorizontal },
  ]

  const query = search.trim().toLowerCase()
  const visible = [...items]
    .sort((a, b) => a.order - b.order)
    .filter((item) => {
      const matchesFilter = filter === 'all' || item.kind === filter
      const matchesSearch = !query || item.title.toLowerCase().includes(query)
      return matchesFilter && matchesSearch
    })

  const getKindIcon = (kind: DashboardItemKind) => {
    switch (kind) {
      case 'chart': return BarChart3
      case 'decision': return ListChecks
      case 'table': return Table2
      case 'metrics': return Gauge
      case 'alert_list': return Bell
      case 'route_map': return MapPinned
      case 'full_spec': return LayoutDashboard
      default: return MoreHorizontal
    }
  }

  const getKindLabel = (kind: DashboardItemKind) => {
    switch (kind) {
      case 'chart': return 'Gráfico'
      case 'decision': return 'Decisión'
      case 'table': return 'Tabla'
      case 'metrics': return 'Métricas'
      case 'alert_list': return 'Alertas'
      case 'route_map': return 'Mapa'
      case 'full_spec': return 'Resultado Completo'
      default: return 'Recurso'
    }
  }

  return (
    <div className="view-screen dashboards-screen">
      <div className="view-heading">
        <div>
          <p className="section-kicker">{t.dashboardsKicker}</p>
          <h2>{t.dashboardsTitle}</h2>
          <p>{t.dashboardsDescription}</p>
        </div>
        <button className="primary-button" onClick={onGoToChat}>
          <Sparkles size={15} /> {t.dashboardsCta}
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-[var(--accent-soft)] text-primary hover:opacity-80'
              }`}
            >
              <Icon size={13} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.dashboardSearch}
          className="w-full rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 md:w-64"
          aria-label={t.dashboardSearch}
        />
      </div>

      {visible.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-[var(--accent-soft)] text-primary">
            <LayoutDashboard size={30} aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h3 className="text-lg font-bold tracking-tight text-foreground">{t.dashboardsEmptyTitle}</h3>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">{t.dashboardsEmptyText}</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-primary transition-opacity hover:opacity-80"
            onClick={onGoToChat}
          >
            <MessageCircle size={13} aria-hidden="true" /> {t.dashboardsGoChat}
          </button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => {
            const Icon = getKindIcon(item.kind)
            return (
              <div
                key={item.id}
                onClick={() => setExpandedItem(item)}
                className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                      <Icon size={20} />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {getKindLabel(item.kind)}
                      </span>
                      <button
                        type="button"
                        className="grid size-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        title={t.removeWidget}
                        aria-label={t.removeWidget}
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteItem(item.id)
                          onNotify(t.removeFromDashboardDone)
                        }}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-1">
                    <h3 className="text-sm font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    {item.subtitle && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1 font-medium text-primary group-hover:underline">
                    Ver componente <Maximize2 size={11} />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL EXPANDIDO CON EL COMPONENTE COMPLETO EN ALTA FIDELIDAD */}
      {expandedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <LayoutDashboard size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground leading-none">{expandedItem.title}</h3>
                  {expandedItem.subtitle && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{expandedItem.subtitle}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    deleteItem(expandedItem.id)
                    setExpandedItem(null)
                    onNotify(t.removeFromDashboardDone)
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Eliminar de Dashboard"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedItem(null)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Cerrar vista"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <JsonRenderClient spec={expandedItem.payload as Spec} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
function IncidentsView({ incidents, onAcknowledge }: { incidents: OrderIncident[]; onAcknowledge: (incidentId: string) => Promise<void> }) {
  return <div className="view-screen"><div className="view-heading"><div><p className="section-kicker">Attention</p><h2>Incidents</h2><p>Review active alerts that require a human decision.</p></div>{incidents.length > 0 && <span className="incident-total">{incidents.length} active</span>}</div>{incidents.length === 0 ? <div className="incident-empty"><ShieldAlert size={24} /><b>No active incidents</b><span>New order incidents will appear here in real time.</span></div> : <div className="incident-list">{incidents.map((incident) => <article className={`incident-row ${incident.severity}`} key={incident.incidentId}><span className="incident-row-icon"><ShieldAlert size={18} /></span><div className="incident-row-copy"><div><strong>{incident.orderId}</strong><span>{incident.type}</span><em>{incident.severity === 'critical' ? 'Critical' : 'Warning'}</em></div><p>{incident.message}</p><small>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(incident.raisedAt))}</small></div><button className="secondary-button" onClick={() => void onAcknowledge(incident.incidentId)}>Acknowledge</button></article>)}</div>}</div>
}

function ViewScreen({ active, onNotify, t, sidebarOpen, onToggleSidebar, dashboard, onNavigate, incidents, onAcknowledge }: { active: string; onNotify: (message: string) => void; t: ReturnType<typeof getTranslations>; sidebarOpen: boolean; onToggleSidebar: () => void; dashboard: ReturnType<typeof useDashboard>; onNavigate: (label: string) => void; incidents: OrderIncident[]; onAcknowledge: (incidentId: string) => Promise<void> }) {
  if (active === 'Map') return <OperationsMapView />
  if (active === 'Dashboards') return <DashboardsView dashboard={dashboard} onNotify={onNotify} onGoToChat={() => onNavigate('Chat')} t={t} />
  if (active === 'Chat') return <AgentBuilderView onNotify={onNotify} sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar} isSaved={dashboard.isSaved} onSaveComponent={dashboard.toggleItem} />
  if (active === 'Incidents') return <IncidentsView incidents={incidents} onAcknowledge={onAcknowledge} />
  const copy: Record<string, { kicker: string; title: string; description: string; items: string[] }> = {
    News: { kicker: 'Communication', title: 'News', description: 'Stay up to date with changes relevant to your logistics network.', items: ['New driving window in Lyon', 'Seur expands coverage to Lisbon', 'Rate update for June'] },
    Settings: { kicker: 'Workspace', title: 'Settings', description: 'Customize your operations center preferences.', items: ['Notifications and alerts', 'Users and permissions', 'Display preferences'] },
    Help: { kicker: 'Support', title: 'Help center', description: 'Find answers and resources to use route.pilot.', items: ['Operations quick guide', 'Manage a run', 'Contact support'] },
  }
  const view = copy[active] ?? copy.News
  return <div className="view-screen"><div className="view-heading"><div><p className="section-kicker">{view.kicker}</p><h2>{view.title}</h2><p>{view.description}</p></div><button className="primary-button" onClick={() => onNotify(`${view.title}: simulated action`)}>+ New action <ChevronRight size={15} /></button></div><div className="view-grid">{view.items.map((item, index) => <button className="view-item" key={item} onClick={() => onNotify(`${item.split(' · ')[0]} selected`)}><span className={`view-item-icon ${index % 2 ? 'violet-icon' : 'pink-icon'}`}><Activity size={17} /></span><span><b>{item.split(' · ')[0]}</b><small>{item.split(' · ').slice(1).join(' · ') || 'View details and activity'}</small></span><ChevronRight size={17} /></button>)}</div></div>
}

function App() {
  const t = getTranslations()
  const [active, setActive] = useState('Chat')
  const [dark, setDark] = useState(false)
  const [notice, setNotice] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentDate, setCurrentDate] = useState('')
  const dashboard = useDashboard()
  const { incidents, acknowledge } = useOrderIncidents()
  const newestIncident = incidents[0]

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('route-pilot-theme')
    if (savedTheme === 'dark') setDark(true)
    else if (savedTheme === 'light') setDark(false)
  }, [])

  function toggleTheme() {
    setDark((prev) => {
      const next = !prev
      window.localStorage.setItem('route-pilot-theme', next ? 'dark' : 'light')
      return next
    })
  }

  useEffect(() => {
    const updateDate = () => setCurrentDate(new Intl.DateTimeFormat(t.dateLocale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date()))

    updateDate()
    const timer = window.setInterval(updateDate, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  function notify(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  function handleNav(label: string) {
    setActive(label)
    setMobileOpen(false)
    notify(`${label} view selected`)
  }

  return (
    <main className={`${dark ? 'app-shell dark-mode dark' : 'app-shell'} ${sidebarOpen ? 'sidebar-visible' : 'sidebar-hidden'}`}>
      <div className="dot-field" aria-hidden="true" />
      <button className="mobile-menu" aria-label="Open menu" onClick={() => setMobileOpen(!mobileOpen)}><Menu size={20} /></button>
      <aside className={mobileOpen ? 'sidebar open' : `sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="brand"><span className="brand-mark"><Zap size={15} fill="currentColor" /></span><span className="font-bold tracking-tight">Ari<span className="brand-dot">.</span>Nauta</span><button className="brand-theme-toggle" aria-label="Change theme" onClick={toggleTheme}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button></div>
        <p className="nav-label">{t.operations}</p>
        <nav aria-label="Main navigation">
          <button className={active === 'Chat' ? 'nav-item active' : 'nav-item'} onClick={() => handleNav('Chat')}><MessageCircle size={17} /><span>Chat</span></button>
          <button className={active === 'Dashboards' ? 'nav-item active' : 'nav-item'} onClick={() => handleNav('Dashboards')}><LayoutDashboard size={17} /><span>Dashboards</span>{dashboard.items.length > 0 && <em>{dashboard.items.length}</em>}</button>
          {navItems.map(({ key, icon: Icon }) => { const label = t[key as keyof typeof t] || (key === 'issues' ? 'Incidents' : 'Map'); const destination = key === 'issues' ? 'Incidents' : 'Map'; return <button key={key} className={active === destination ? 'nav-item active' : 'nav-item'} onClick={() => handleNav(destination)}><Icon size={17} /><span>{label}</span>{key === 'issues' && incidents.length > 0 && <em>{incidents.length}</em>}</button> })}
        </nav>
        <p className="nav-label secondary-label">{t.workspace}</p>
        <button className="nav-item" onClick={() => notify('Settings ready to configure')}><Settings size={17} /><span>{t.settings}</span></button>
        <button className="nav-item" onClick={() => notify('Help center opened')}><CircleHelp size={17} /><span>{t.help}</span></button>
        <div className="sidebar-bottom">
          <div className="sidebar-controls">
            <button className="sidebar-icon-button notification" aria-label={t.notifications} onClick={() => notify('You have 3 new notifications')}><Bell size={17} /><i /></button>
          </div>
        </div>
      </aside>

      <section className={active === 'Chat' ? 'content-area chat-mode' : 'content-area'}>
        {active !== 'Chat' && <header className="topbar"><div><p className="eyebrow">{currentDate || t.loadingDate}</p><h1>{active}</h1></div></header>}

        <ViewScreen active={active} onNotify={notify} t={t} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} dashboard={dashboard} onNavigate={handleNav} incidents={incidents} onAcknowledge={acknowledge} />
      </section>
      {newestIncident && <aside className={`incident-alert ${newestIncident.severity}`} role="alert" aria-live="assertive"><span className="incident-alert-icon"><ShieldAlert size={19} /></span><div className="incident-alert-copy"><div><strong>{newestIncident.severity === 'critical' ? 'Critical incident' : 'Order warning'}</strong>{incidents.length > 1 && <em>{incidents.length} active</em>}</div><p><b>{newestIncident.orderId}</b> · {newestIncident.message}</p></div><button onClick={() => handleNav('Incidents')}>View incident <ChevronRight size={15} /></button></aside>}
      {active !== 'Chat' && <button className="floating-chat" aria-label={t.openChat} onClick={() => { setActive('Chat'); setMobileOpen(false); notify('route.pilot AI chat opened') }}><Sparkles size={19} /><span>AI Chat</span></button>}
      {notice && <div className="toast"><Sparkles size={15} />{notice}</div>}
    </main>
  )
}

export default function Page() { return <App /> }
