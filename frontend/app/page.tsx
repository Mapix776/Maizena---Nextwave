'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { getTranslations, localeLabels, type Locale } from '@/lib/i18n'
import { useSavedSpecs } from '@/lib/use-saved-specs'
import nextDynamic from 'next/dynamic'
import {
  Activity,
  BarChart3,
  Bell,
  Bookmark,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Filter,
  LayoutDashboard,
  Languages,
  ListTodo,
  MapPinned,
  Menu,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Newspaper,
  Paperclip,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  Truck,
  UserRound,
  WalletCards,
  Zap,
} from 'lucide-react'

const OperationsMapView = nextDynamic(() => import('@/app/components/operations-map'), { ssr: false })
const AgentBuilderView = nextDynamic(() => import('@/app/components/agent-builder'), { ssr: false })
const SavedView = nextDynamic(() => import('@/app/components/saved-view'), { ssr: false })

type Run = { id: string; route: string; carrier: string; status: string; eta: string; tone: string }

const runs: Run[] = [
  { id: 'RUN-2048', route: 'Madrid → Lyon', carrier: 'DHL Freight', status: 'En tránsito', eta: 'Hoy, 18:40', tone: 'pink' },
  { id: 'RUN-2047', route: 'Valencia → Lisboa', carrier: 'Seur', status: 'En preparación', eta: 'Mañana, 09:20', tone: 'violet' },
  { id: 'RUN-2046', route: 'Bilbao → París', carrier: 'DB Schenker', status: 'Revisar', eta: 'Mañana, 13:00', tone: 'amber' },
]

const navItems = [
  { key: 'summary', icon: LayoutDashboard },
  { key: 'issues', icon: ShieldAlert, badge: '3' },
  { key: 'map', icon: MapPinned },
  { key: 'analytics', icon: BarChart3 },
]

function MiniBars() {
  return (
    <div className="mini-bars" aria-label="Actividad semanal">
      {[42, 64, 35, 72, 54, 82, 48].map((height, index) => (
        <div className="bar-column" key={index}>
          <span style={{ height: `${height}%` }} className={index === 3 ? 'hot' : ''} />
          <small>{['L', 'M', 'X', 'J', 'V', 'S', 'D'][index]}</small>
        </div>
      ))}
    </div>
  )
}

function AnalyticsView({ onNotify, t }: { onNotify: (message: string) => void; t: ReturnType<typeof getTranslations> }) {
  const bars = [48, 66, 54, 79, 61, 88, 72]
  return <div className="analytics-screen"><div className="view-heading"><div><p className="section-kicker">{t.intelligence}</p><h2>{t.analytics}</h2><p>{t.analyticsDescription}</p></div><button className="primary-button" onClick={() => onNotify('Informe exportado en modo demo')}>Exportar informe <ChevronRight size={15} /></button></div><div className="analytics-kpis"><div><span>Entrega a tiempo</span><strong>94,2%</strong><small className="positive">+3,8% este mes</small></div><div><span>Km recorridos</span><strong>128.460</strong><small className="positive">+12,4% vs. anterior</small></div><div><span>Coste medio / run</span><strong>602€</strong><small className="positive">-6,1% optimizado</small></div><div><span>Incidencias resueltas</span><strong>87%</strong><small>12 abiertas</small></div></div><div className="analytics-grid"><div className="panel analytics-chart"><div className="panel-heading"><div><p className="section-kicker">Volumen de operaciones</p><h3>Runs completados</h3></div><button className="filter-button" onClick={() => onNotify('Periodo cambiado a este mes')}>Este mes <ChevronRight size={13} /></button></div><div className="analytics-bars">{bars.map((height, index) => <div className="analytics-bar-col" key={index}><div className="analytics-bar-track"><span style={{ height: `${height}%` }} /></div><small>{['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'][index]}</small></div>)}</div></div><div className="panel analytics-ring-panel"><div className="panel-heading"><div><p className="section-kicker">Salud de red</p><h3>Eficiencia global</h3></div><button className="dots-button" onClick={() => onNotify('Detalle de eficiencia abierto')}><MoreHorizontal size={18} /></button></div><div className="analytics-ring"><span>94<small>%</small></span></div><div className="legend"><span><i className="legend-pink" /> En objetivo <b>76%</b></span><span><i className="legend-violet" /> Necesita revisión <b>18%</b></span><span><i className="legend-gray" /> Sin datos <b>6%</b></span></div></div><div className="panel analytics-chart wide"><div className="panel-heading"><div><p className="section-kicker">Comparativa de rutas</p><h3>Coste por kilómetro</h3></div><span className="chart-value">0,84€ <small>media actual</small></span></div><div className="cost-lines"><div className="cost-line"><span>Madrid → Lyon</span><div><i style={{ width: '82%' }} /></div><b>0,72€</b></div><div className="cost-line"><span>Valencia → Lisboa</span><div><i style={{ width: '67%' }} /></div><b>0,68€</b></div><div className="cost-line"><span>Bilbao → París</span><div><i style={{ width: '94%' }} /></div><b>0,91€</b></div><div className="cost-line"><span>Sevilla → Marsella</span><div><i style={{ width: '76%' }} /></div><b>0,79€</b></div></div></div></div></div>
}

function ViewScreen({ active, onNotify, t, locale, sidebarOpen, onToggleSidebar, saved, onNavigate }: { active: string; onNotify: (message: string) => void; t: ReturnType<typeof getTranslations>; locale: Locale; sidebarOpen: boolean; onToggleSidebar: () => void; saved: ReturnType<typeof useSavedSpecs>; onNavigate: (label: string) => void }) {
  if (active === 'Mapa') return <OperationsMapView />
  if (active === 'Analíticas') return <AnalyticsView onNotify={onNotify} t={t} />
  if (active === 'Guardados') return <SavedView savedSpecs={saved.savedSpecs} onRemove={saved.removeSpec} onNotify={onNotify} onGoToChat={() => onNavigate('Chat')} t={t} dateLocale={t.dateLocale} />
  if (active === 'Chat') return <AgentBuilderView onNotify={onNotify} locale={locale} sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar} isSaved={saved.isSaved} onToggleSave={saved.toggleSave} />
  const copy: Record<string, { kicker: string; title: string; description: string; items: string[] }> = {
    Incidencias: { kicker: 'Atención', title: 'Incidencias', description: 'Revisa las alertas que requieren una decisión humana.', items: ['Retraso de 35 min · RUN-2046', 'Documentación pendiente · RUN-2047', 'Cambio de muelle solicitado · Centro Lyon'] },
    Chat: { kicker: 'Comunicación', title: 'Chat del equipo', description: 'Coordina decisiones rápidas con las personas de operaciones.', items: ['Lucía · ¿Confirmamos la salida de Valencia?', 'Diego · El muelle 4 ya está disponible', 'Marina · He actualizado el ETA de Lyon'] },
    Noticias: { kicker: 'Comunicación', title: 'Noticias', description: 'Mantente al día de cambios relevantes para tu red logística.', items: ['Nueva ventana de circulación en Lyon', 'Seur amplía cobertura para Lisboa', 'Actualización de tarifas para junio'] },
    Ajustes: { kicker: 'Workspace', title: 'Ajustes', description: 'Personaliza las preferencias de tu centro de operaciones.', items: ['Notificaciones y alertas', 'Usuarios y permisos', 'Preferencias de visualización'] },
    Ayuda: { kicker: 'Soporte', title: 'Centro de ayuda', description: 'Encuentra respuestas y recursos para usar route.pilot.', items: ['Guía rápida de operaciones', 'Gestionar un run', 'Contactar con soporte'] },
  }
  const view = copy[active] ?? copy.Resumen
  return <div className="view-screen"><div className="view-heading"><div><p className="section-kicker">{view.kicker}</p><h2>{view.title}</h2><p>{view.description}</p></div><button className="primary-button" onClick={() => onNotify(`${view.title}: acción simulada`)}>+ Nueva acción <ChevronRight size={15} /></button></div><div className="view-grid">{view.items.map((item, index) => <button className="view-item" key={item} onClick={() => onNotify(`${item.split(' · ')[0]} seleccionado`)}><span className={`view-item-icon ${index % 2 ? 'violet-icon' : 'pink-icon'}`}><Activity size={17} /></span><span><b>{item.split(' · ')[0]}</b><small>{item.split(' · ').slice(1).join(' · ') || 'Ver detalles y actividad'}</small></span><ChevronRight size={17} /></button>)}</div></div>
}

function App() {
  const [locale, setLocale] = useState<Locale>('es')
  const [languageOpen, setLanguageOpen] = useState(false)
  const t = getTranslations(locale)
  const [active, setActive] = useState('Resumen')
  const [dark, setDark] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentDate, setCurrentDate] = useState('')
  const saved = useSavedSpecs()

  useEffect(() => {
    const savedLocale = window.localStorage.getItem('route-pilot-locale') as Locale | null
    if (savedLocale && savedLocale in localeLabels) setLocale(savedLocale)
  }, [])

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

  const filteredRuns = useMemo(() => runs.filter((run) => `${run.id} ${run.route} ${run.carrier}`.toLowerCase().includes(query.toLowerCase())), [query])

  function notify(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  function handleNav(label: string) {
    setActive(label)
    setMobileOpen(false)
    notify(`Vista ${label} seleccionada`)
  }

  return (
    <main className={`${dark ? 'app-shell dark-mode' : 'app-shell'} ${sidebarOpen ? 'sidebar-visible' : 'sidebar-hidden'}`}>
      <div className="dot-field" aria-hidden="true" />
      <button className="mobile-menu" aria-label="Abrir menú" onClick={() => setMobileOpen(!mobileOpen)}><Menu size={20} /></button>
      <aside className={mobileOpen ? 'sidebar open' : `sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="brand"><span className="brand-mark"><Zap size={15} fill="currentColor" /></span><span>route<span className="brand-dot">.</span>pilot</span></div>
        <div className="workspace"><div className="workspace-avatar">MS</div><div><b>Muebles del Sur</b><small>{t.principalWorkspace}</small></div><ChevronRight size={15} /></div>
        <p className="nav-label">{t.operations}</p>
        <nav aria-label="Navegación principal">
          <button className={active === 'Chat' ? 'nav-item active' : 'nav-item'} onClick={() => handleNav('Chat')}><MessageCircle size={17} /><span>Chat</span></button>
          <button className={active === 'Guardados' ? 'nav-item active' : 'nav-item'} onClick={() => handleNav('Guardados')}><Bookmark size={17} /><span>{t.savedNav}</span>{saved.savedSpecs.length > 0 && <em>{saved.savedSpecs.length}</em>}</button>
          {navItems.map(({ key, icon: Icon, badge }) => { const label = t[key as keyof typeof t]; return <button key={key} className={active === key ? 'nav-item active' : 'nav-item'} onClick={() => handleNav(key === 'summary' ? 'Resumen' : key === 'issues' ? 'Incidencias' : key === 'map' ? 'Mapa' : 'Analíticas')}><Icon size={17} /><span>{label}</span>{badge && <em>{badge}</em>}</button> })}
          <button className={active === 'Noticias' ? 'nav-item active' : 'nav-item'} onClick={() => handleNav('Noticias')}><Newspaper size={17} /><span>Noticias</span><em className="news-dot">2</em></button>
        </nav>
        <p className="nav-label secondary-label">{t.workspace}</p>
        <button className="nav-item" onClick={() => notify('Ajustes listos para configurar')}><Settings size={17} /><span>{t.settings}</span></button>
        <button className="nav-item" onClick={() => notify('Centro de ayuda abierto')}><CircleHelp size={17} /><span>{t.help}</span></button>
        <div className="sidebar-bottom">
          <div className="sidebar-controls">
            <div className="language-select"><button type="button" className="sidebar-control-button" aria-expanded={languageOpen} aria-haspopup="listbox" onClick={() => setLanguageOpen((open) => !open)}><Languages size={16} aria-hidden="true" /><span>{localeLabels[locale]}</span><ChevronDown size={14} aria-hidden="true" /></button>{languageOpen && <div className="language-menu language-menu-up" role="listbox" aria-label={t.language}>{(Object.keys(localeLabels) as Locale[]).map((key) => <button type="button" role="option" aria-selected={locale === key} className={locale === key ? 'language-option selected' : 'language-option'} key={key} onClick={() => { setLocale(key); setLanguageOpen(false); window.localStorage.setItem('route-pilot-locale', key) }}><span className={`language-flag ${key}`}>{key === 'es' ? 'ES' : key === 'en' ? 'EN' : 'PT'}</span><span>{localeLabels[key]}</span>{locale === key && <span className="language-check">✓</span>}</button>)}</div>}</div>
            <button className="sidebar-icon-button" aria-label="Cambiar tema" onClick={() => setDark(!dark)}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
            <button className="sidebar-icon-button notification" aria-label="Notificaciones" onClick={() => notify('Tienes 3 notificaciones nuevas')}><Bell size={17} /><i /></button>
          </div>
          <div className="profile"><div className="profile-avatar">AR</div><div><b>Alex Rivera</b><small>Administrador</small></div><MoreHorizontal size={17} /></div>
        </div>
      </aside>

      <section className={active === 'Chat' ? 'content-area chat-mode' : 'content-area'}>
        {active !== 'Chat' && <header className="topbar"><div><p className="eyebrow">{currentDate || t.loadingDate}</p><h1>{active === 'Resumen' ? t.goodMorning : active}</h1></div></header>}

        {active === 'Resumen' ? <>
        <div className="hero-card"><div><span className="pill pink-pill">{t.operationalSummary} <Activity size={13} /></span><h2>{t.allControl}</h2><p>{t.networkCapacity} <strong>94%</strong> de capacidad. {t.decisionsAttention}</p><button className="primary-button" onClick={() => { setActive('Incidencias'); notify(t.review) }}>{t.review} <ChevronRight size={15} /></button></div><div className="hero-art"><div className="route-line line-one" /><div className="route-line line-two" /><Truck size={84} strokeWidth={1.2} /><span className="map-pin pin-one" /><span className="map-pin pin-two" /></div></div>

        <div className="metric-grid"><div className="metric-card"><div className="metric-icon pink-icon"><Truck size={17} /></div><div><span>{t.activeRuns}</span><strong>23</strong><small className="positive">+12% <span>vs. semana pasada</span></small></div></div><div className="metric-card"><div className="metric-icon violet-icon"><Clock3 size={17} /></div><div><span>{t.eta}</span><strong>36h</strong><small className="positive">-8% <span>más rápido</span></small></div></div><div className="metric-card"><div className="metric-icon blue-icon"><WalletCards size={17} /></div><div><span>{t.costKm}</span><strong>0,84€</strong><small className="positive">-4,2% <span>este mes</span></small></div></div><div className="metric-card score-card"><div className="score-ring"><span>94<small>%</small></span></div><div><span>{t.networkHealth}</span><strong>{t.excellent}</strong><small>2 {locale === 'en' ? 'minor alerts' : locale === 'pt' ? 'alertas leves' : 'alertas leves'}</small></div></div></div>

        <div className="dashboard-grid"><div className="panel activity-panel"><div className="panel-heading"><div><p className="section-kicker">{t.performance}</p><h3>{t.runActivity}</h3></div><button className="filter-button" onClick={() => notify(t.thisWeek)}><Filter size={14} /> {t.thisWeek}</button></div><div className="chart-wrap"><div className="y-axis"><span>30</span><span>20</span><span>10</span><span>0</span></div><svg className="line-chart" viewBox="0 0 600 190" preserveAspectRatio="none" role="img" aria-label="Gráfico de actividad semanal"><path className="chart-area" d="M0,148 C40,125 54,48 90,88 S145,142 184,103 S240,36 275,76 S321,138 360,105 S410,62 440,93 S495,153 525,112 S560,48 600,63 V190 H0 Z" /><path className="chart-line" d="M0,148 C40,125 54,48 90,88 S145,142 184,103 S240,36 275,76 S321,138 360,105 S410,62 440,93 S495,153 525,112 S560,48 600,63" /></svg></div><div className="chart-labels"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div></div>
          <div className="panel cost-panel"><div className="panel-heading"><div><p className="section-kicker">{t.finances}</p><h3>{t.operatingCost}</h3></div><button className="dots-button" onClick={() => notify('Más opciones de finanzas')}><MoreHorizontal size={18} /></button></div><p className="big-number">13.840€ <small>este mes</small></p><MiniBars /><div className="budget-line"><span>Presupuesto mensual</span><b>72%</b></div><div className="progress"><span style={{ width: '72%' }} /></div></div>
          <div className="panel runs-panel"><div className="panel-heading"><div><p className="section-kicker">{t.tracking}</p><h3>{t.recentRuns}</h3></div><button className="text-button" onClick={() => setShowAll(!showAll)}>{showAll ? t.seeLess : t.seeAll} <ChevronRight size={14} /></button></div><div className="run-list">{filteredRuns.slice(0, showAll ? 3 : 2).map((run) => <button className="run-row" key={run.id} onClick={() => notify(`${run.id} seleccionado`)}><span className={`run-icon ${run.tone}`}><Truck size={16} /></span><span className="run-info"><b>{run.route}</b><small>{run.id} · {run.carrier}</small></span><span className={`status ${run.tone}`}>{locale === 'en' ? ({ 'En tránsito': 'In transit', 'En preparación': 'Preparing', Revisar: 'Review' }[run.status] ?? run.status) : locale === 'pt' ? ({ 'En tránsito': 'Em trânsito', 'En preparación': 'Em preparação', Revisar: 'Revisar' }[run.status] ?? run.status) : run.status}</span><span className="run-eta">{run.eta}</span><ChevronRight size={15} /></button>)}</div></div>
        </div>
        </> : <ViewScreen active={active} onNotify={notify} t={t} locale={locale} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} saved={saved} onNavigate={handleNav} />}
      </section>
      {active !== 'Chat' && <button className="floating-chat" aria-label="Abrir chatbot de IA" onClick={() => { setActive('Chat'); setMobileOpen(false); notify('Chat con route.pilot AI abierto') }}><Sparkles size={19} /><span>Chat IA</span></button>}
      {notice && <div className="toast"><Sparkles size={15} />{notice}</div>}
    </main>
  )
}

export default function Page() { return <App /> }
