'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { getTranslations } from '@/lib/i18n'
import { useOrderIncidents } from '@/lib/use-order-incidents'
import { useSavedSpecs } from '@/lib/use-saved-specs'
import nextDynamic from 'next/dynamic'
import type { OrderIncident } from '../../backend/src/contracts/order-incident'
import {
  Activity,
  BarChart3,
  Bell,
  Bookmark,
  ChevronRight,
  CircleHelp,
  MapPinned,
  Menu,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Newspaper,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  Zap,
} from 'lucide-react'

const OperationsMapView = nextDynamic(() => import('@/app/components/operations-map'), { ssr: false })
const AgentBuilderView = nextDynamic(() => import('@/app/components/agent-builder'), { ssr: false })
const SavedView = nextDynamic(() => import('@/app/components/saved-view'), { ssr: false })

const navItems = [
  { key: 'issues', icon: ShieldAlert },
  { key: 'map', icon: MapPinned },
  { key: 'analytics', icon: BarChart3 },
]

function AnalyticsView({ onNotify, t }: { onNotify: (message: string) => void; t: ReturnType<typeof getTranslations> }) {
  const bars = [48, 66, 54, 79, 61, 88, 72]
  return <div className="analytics-screen"><div className="view-heading"><div><p className="section-kicker">{t.intelligence}</p><h2>{t.analytics}</h2><p>{t.analyticsDescription}</p></div><button className="primary-button" onClick={() => onNotify(t.exportSuccess)}>{t.exportReport} <ChevronRight size={15} /></button></div><div className="analytics-kpis"><div><span>On-time delivery</span><strong>94.2%</strong><small className="positive">+3.8% this month</small></div><div><span>Distance traveled</span><strong>128,460</strong><small className="positive">+12.4% vs. previous</small></div><div><span>Average cost / run</span><strong>€602</strong><small className="positive">-6.1% optimized</small></div><div><span>Issues resolved</span><strong>87%</strong><small>12 open</small></div></div><div className="analytics-grid"><div className="panel analytics-chart"><div className="panel-heading"><div><p className="section-kicker">Operations volume</p><h3>Completed operations</h3></div><button className="filter-button" onClick={() => onNotify('Period changed to this month')}>This month <ChevronRight size={13} /></button></div><div className="analytics-bars">{bars.map((height, index) => <div className="analytics-bar-col" key={index}><div className="analytics-bar-track"><span style={{ height: `${height}%` }} /></div><small>{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'][index]}</small></div>)}</div></div><div className="panel analytics-ring-panel"><div className="panel-heading"><div><p className="section-kicker">Network health</p><h3>Global efficiency</h3></div><button className="dots-button" onClick={() => onNotify('Efficiency detail opened')}><MoreHorizontal size={18} /></button></div><div className="analytics-ring"><span>94<small>%</small></span></div><div className="legend"><span><i className="legend-pink" /> On target <b>76%</b></span><span><i className="legend-violet" /> Needs review <b>18%</b></span><span><i className="legend-gray" /> No data <b>6%</b></span></div></div><div className="panel analytics-chart wide"><div className="panel-heading"><div><p className="section-kicker">Route comparison</p><h3>Cost per kilometer</h3></div><span className="chart-value">€0.84 <small>current average</small></span></div><div className="cost-lines"><div className="cost-line"><span>Madrid → Lyon</span><div><i style={{ width: '82%' }} /></div><b>€0.72</b></div><div className="cost-line"><span>Valencia → Lisbon</span><div><i style={{ width: '67%' }} /></div><b>€0.68</b></div><div className="cost-line"><span>Bilbao → Paris</span><div><i style={{ width: '94%' }} /></div><b>€0.91</b></div><div className="cost-line"><span>Seville → Marseille</span><div><i style={{ width: '76%' }} /></div><b>€0.79</b></div></div></div></div></div>
}

function IncidentsView({ incidents, onAcknowledge }: { incidents: OrderIncident[]; onAcknowledge: (incidentId: string) => Promise<void> }) {
  return <div className="view-screen"><div className="view-heading"><div><p className="section-kicker">Attention</p><h2>Incidents</h2><p>Review active alerts that require a human decision.</p></div>{incidents.length > 0 && <span className="incident-total">{incidents.length} active</span>}</div>{incidents.length === 0 ? <div className="incident-empty"><ShieldAlert size={24} /><b>No active incidents</b><span>New order incidents will appear here in real time.</span></div> : <div className="incident-list">{incidents.map((incident) => <article className={`incident-row ${incident.severity}`} key={incident.incidentId}><span className="incident-row-icon"><ShieldAlert size={18} /></span><div className="incident-row-copy"><div><strong>{incident.orderId}</strong><span>{incident.type}</span><em>{incident.severity === 'critical' ? 'Critical' : 'Warning'}</em></div><p>{incident.message}</p><small>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(incident.raisedAt))}</small></div><button className="secondary-button" onClick={() => void onAcknowledge(incident.incidentId)}>Acknowledge</button></article>)}</div>}</div>
}

function ViewScreen({ active, onNotify, t, sidebarOpen, onToggleSidebar, saved, onNavigate, incidents, onAcknowledge }: { active: string; onNotify: (message: string) => void; t: ReturnType<typeof getTranslations>; sidebarOpen: boolean; onToggleSidebar: () => void; saved: ReturnType<typeof useSavedSpecs>; onNavigate: (label: string) => void; incidents: OrderIncident[]; onAcknowledge: (incidentId: string) => Promise<void> }) {
  if (active === 'Map') return <OperationsMapView />
  if (active === 'Analytics') return <AnalyticsView onNotify={onNotify} t={t} />
  if (active === 'Saved') return <SavedView savedSpecs={saved.savedSpecs} onRemove={saved.removeSpec} onNotify={onNotify} onGoToChat={() => onNavigate('Chat')} t={t} dateLocale={t.dateLocale} />
  if (active === 'Chat') return <AgentBuilderView onNotify={onNotify} sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar} isSaved={saved.isSaved} onToggleSave={saved.toggleSave} />
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
  const saved = useSavedSpecs()
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
        <div className="brand"><span className="brand-mark"><Zap size={15} fill="currentColor" /></span><span>route<span className="brand-dot">.</span>pilot</span><button className="brand-theme-toggle" aria-label="Change theme" onClick={toggleTheme}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button></div>
        <div className="workspace"><div className="workspace-avatar">MS</div><div><b>Muebles del Sur</b><small>{t.principalWorkspace}</small></div><ChevronRight size={15} /></div>
        <p className="nav-label">{t.operations}</p>
        <nav aria-label="Main navigation">
          <button className={active === 'Chat' ? 'nav-item active' : 'nav-item'} onClick={() => handleNav('Chat')}><MessageCircle size={17} /><span>Chat</span></button>
          <button className={active === 'Saved' ? 'nav-item active' : 'nav-item'} onClick={() => handleNav('Saved')}><Bookmark size={17} /><span>{t.savedNav}</span>{saved.savedSpecs.length > 0 && <em>{saved.savedSpecs.length}</em>}</button>
          {navItems.map(({ key, icon: Icon }) => { const label = t[key as keyof typeof t]; const destination = key === 'issues' ? 'Incidents' : key === 'map' ? 'Map' : 'Analytics'; return <button key={key} className={active === destination ? 'nav-item active' : 'nav-item'} onClick={() => handleNav(destination)}><Icon size={17} /><span>{label}</span>{key === 'issues' && incidents.length > 0 && <em>{incidents.length}</em>}</button> })}
          <button className={active === 'News' ? 'nav-item active' : 'nav-item'} onClick={() => handleNav('News')}><Newspaper size={17} /><span>{t.news}</span><em className="news-dot">2</em></button>
        </nav>
        <p className="nav-label secondary-label">{t.workspace}</p>
        <button className="nav-item" onClick={() => notify('Settings ready to configure')}><Settings size={17} /><span>{t.settings}</span></button>
        <button className="nav-item" onClick={() => notify('Help center opened')}><CircleHelp size={17} /><span>{t.help}</span></button>
        <div className="sidebar-bottom">
          <div className="sidebar-controls">
            <button className="sidebar-icon-button notification" aria-label={t.notifications} onClick={() => notify('You have 3 new notifications')}><Bell size={17} /><i /></button>
          </div>
          <div className="profile"><div className="profile-avatar">AR</div><div><b>Alex Rivera</b><small>{t.administrator}</small></div><MoreHorizontal size={17} /></div>
        </div>
      </aside>

      <section className={active === 'Chat' ? 'content-area chat-mode' : 'content-area'}>
        {active !== 'Chat' && <header className="topbar"><div><p className="eyebrow">{currentDate || t.loadingDate}</p><h1>{active}</h1></div></header>}

        <ViewScreen active={active} onNotify={notify} t={t} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} saved={saved} onNavigate={handleNav} incidents={incidents} onAcknowledge={acknowledge} />
      </section>
      {newestIncident && <aside className={`incident-alert ${newestIncident.severity}`} role="alert" aria-live="assertive"><span className="incident-alert-icon"><ShieldAlert size={19} /></span><div className="incident-alert-copy"><div><strong>{newestIncident.severity === 'critical' ? 'Critical incident' : 'Order warning'}</strong>{incidents.length > 1 && <em>{incidents.length} active</em>}</div><p><b>{newestIncident.orderId}</b> · {newestIncident.message}</p></div><button onClick={() => handleNav('Incidents')}>View incident <ChevronRight size={15} /></button></aside>}
      {active !== 'Chat' && <button className="floating-chat" aria-label={t.openChat} onClick={() => { setActive('Chat'); setMobileOpen(false); notify('route.pilot AI chat opened') }}><Sparkles size={19} /><span>AI Chat</span></button>}
      {notice && <div className="toast"><Sparkles size={15} />{notice}</div>}
    </main>
  )
}

export default function Page() { return <App /> }
