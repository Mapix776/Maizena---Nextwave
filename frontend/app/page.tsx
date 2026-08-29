'use client'

export const dynamic = 'force-dynamic'

import { useMemo, useState } from 'react'
import nextDynamic from 'next/dynamic'
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Clock3,
  Filter,
  LayoutDashboard,
  ListTodo,
  MapPinned,
  Menu,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Newspaper,
  Paperclip,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  Truck,
  UserRound,
  WalletCards,
  X,
  Zap,
} from 'lucide-react'

const FleetMap = nextDynamic(() => import('@/app/components/fleet-map'), { ssr: false })
const OperationsMapView = nextDynamic(() => import('@/app/components/operations-map'), { ssr: false })
const AgentBuilderView = nextDynamic(() => import('@/app/components/agent-builder'), { ssr: false })

type Run = { id: string; route: string; carrier: string; status: string; eta: string; tone: string }

const runs: Run[] = [
  { id: 'RUN-2048', route: 'Madrid → Lyon', carrier: 'DHL Freight', status: 'En tránsito', eta: 'Hoy, 18:40', tone: 'pink' },
  { id: 'RUN-2047', route: 'Valencia → Lisboa', carrier: 'Seur', status: 'En preparación', eta: 'Mañana, 09:20', tone: 'violet' },
  { id: 'RUN-2046', route: 'Bilbao → París', carrier: 'DB Schenker', status: 'Revisar', eta: 'Mañana, 13:00', tone: 'amber' },
]

const navItems = [
  { label: 'Resumen', icon: LayoutDashboard },
  { label: 'Runs', icon: Truck },
  { label: 'Flota', icon: PackageCheck },
  { label: 'Calendario', icon: CalendarDays },
  { label: 'Incidencias', icon: ShieldAlert, badge: '3' },
  { label: 'Mapa', icon: MapPinned },
  { label: 'Analíticas', icon: BarChart3 },
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

function AnalyticsView({ onNotify }: { onNotify: (message: string) => void }) {
  const bars = [48, 66, 54, 79, 61, 88, 72]
  return <div className="analytics-screen"><div className="view-heading"><div><p className="section-kicker">Inteligencia operativa</p><h2>Analíticas</h2><p>Convierte el movimiento de tu red en decisiones más claras y rápidas.</p></div><button className="primary-button" onClick={() => onNotify('Informe exportado en modo demo')}>Exportar informe <ChevronRight size={15} /></button></div><div className="analytics-kpis"><div><span>Entrega a tiempo</span><strong>94,2%</strong><small className="positive">+3,8% este mes</small></div><div><span>Km recorridos</span><strong>128.460</strong><small className="positive">+12,4% vs. anterior</small></div><div><span>Coste medio / run</span><strong>602€</strong><small className="positive">-6,1% optimizado</small></div><div><span>Incidencias resueltas</span><strong>87%</strong><small>12 abiertas</small></div></div><div className="analytics-grid"><div className="panel analytics-chart"><div className="panel-heading"><div><p className="section-kicker">Volumen de operaciones</p><h3>Runs completados</h3></div><button className="filter-button" onClick={() => onNotify('Periodo cambiado a este mes')}>Este mes <ChevronRight size={13} /></button></div><div className="analytics-bars">{bars.map((height, index) => <div className="analytics-bar-col" key={index}><div className="analytics-bar-track"><span style={{ height: `${height}%` }} /></div><small>{['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'][index]}</small></div>)}</div></div><div className="panel analytics-ring-panel"><div className="panel-heading"><div><p className="section-kicker">Salud de red</p><h3>Eficiencia global</h3></div><button className="dots-button" onClick={() => onNotify('Detalle de eficiencia abierto')}><MoreHorizontal size={18} /></button></div><div className="analytics-ring"><span>94<small>%</small></span></div><div className="legend"><span><i className="legend-pink" /> En objetivo <b>76%</b></span><span><i className="legend-violet" /> Necesita revisión <b>18%</b></span><span><i className="legend-gray" /> Sin datos <b>6%</b></span></div></div><div className="panel analytics-chart wide"><div className="panel-heading"><div><p className="section-kicker">Comparativa de rutas</p><h3>Coste por kilómetro</h3></div><span className="chart-value">0,84€ <small>media actual</small></span></div><div className="cost-lines"><div className="cost-line"><span>Madrid → Lyon</span><div><i style={{ width: '82%' }} /></div><b>0,72€</b></div><div className="cost-line"><span>Valencia → Lisboa</span><div><i style={{ width: '67%' }} /></div><b>0,68€</b></div><div className="cost-line"><span>Bilbao → París</span><div><i style={{ width: '94%' }} /></div><b>0,91€</b></div><div className="cost-line"><span>Sevilla → Marsella</span><div><i style={{ width: '76%' }} /></div><b>0,79€</b></div></div></div></div></div>
}

function ViewScreen({ active, onNotify }: { active: string; onNotify: (message: string) => void }) {
  if (active === 'Mapa') return <OperationsMapView />
  if (active === 'Analíticas') return <AnalyticsView onNotify={onNotify} />
  if (active === 'Chat') return <AgentBuilderView onNotify={onNotify} />
  const copy: Record<string, { kicker: string; title: string; description: string; items: string[] }> = {
    Runs: { kicker: 'Operaciones', title: 'Todos los runs', description: 'Supervisa rutas activas, próximos movimientos y estados de entrega.', items: ['RUN-2048 · Madrid → Lyon · En tránsito', 'RUN-2047 · Valencia → Lisboa · En preparación', 'RUN-2046 · Bilbao → París · Revisar'] },
    Flota: { kicker: 'Recursos', title: 'Flota disponible', description: 'Consulta el estado de tus vehículos y su próxima asignación.', items: ['TRK-018 · Volvo FH · Disponible', 'TRK-024 · Mercedes Actros · En ruta', 'TRK-031 · Scania R · Mantenimiento'] },
    Calendario: { kicker: 'Planificación', title: 'Calendario operativo', description: 'Organiza salidas, ventanas de entrega y turnos del equipo.', items: ['09:20 · Valencia → Lisboa · 2 vehículos', '13:00 · Bilbao → París · 1 vehículo', '18:40 · Madrid → Lyon · Entrega prevista'] },
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
  const [active, setActive] = useState('Resumen')
  const [dark, setDark] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const filteredRuns = useMemo(() => runs.filter((run) => `${run.id} ${run.route} ${run.carrier}`.toLowerCase().includes(query.toLowerCase())), [query])

  function notify(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  function handleNav(label: string) {
    setActive(label)
    setMobileOpen(false)
    if (label === 'Chat') setSidebarOpen(false)
    notify(`Vista ${label} seleccionada`)
  }

  return (
    <main className={`${dark ? 'app-shell dark-mode' : 'app-shell'} ${sidebarOpen ? 'sidebar-visible' : 'sidebar-hidden'}`}>
      <div className="dot-field" aria-hidden="true" />
      <button className="mobile-menu" aria-label="Abrir menú" onClick={() => setMobileOpen(!mobileOpen)}><Menu size={20} /></button>
      <aside className={mobileOpen ? 'sidebar open' : `sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="brand"><span className="brand-mark"><Zap size={15} fill="currentColor" /></span><span>route<span className="brand-dot">.</span>pilot</span></div>
        <div className="workspace"><div className="workspace-avatar">MS</div><div><b>Muebles del Sur</b><small>Workspace principal</small></div><ChevronRight size={15} /></div>
        <p className="nav-label">Operaciones</p>
        <nav aria-label="Navegación principal">
          <button className={active === 'Chat' ? 'nav-item active' : 'nav-item'} onClick={() => handleNav('Chat')}><MessageCircle size={17} /><span>Chat</span></button>
          {navItems.map(({ label, icon: Icon, badge }) => <button key={label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => handleNav(label)}><Icon size={17} /><span>{label}</span>{badge && <em>{badge}</em>}</button>)}
          <button className={active === 'Noticias' ? 'nav-item active' : 'nav-item'} onClick={() => handleNav('Noticias')}><Newspaper size={17} /><span>Noticias</span><em className="news-dot">2</em></button>
        </nav>
        <p className="nav-label secondary-label">Workspace</p>
        <button className="nav-item" onClick={() => notify('Ajustes listos para configurar')}><Settings size={17} /><span>Ajustes</span></button>
        <button className="nav-item" onClick={() => notify('Centro de ayuda abierto')}><CircleHelp size={17} /><span>Ayuda</span></button>
        <div className="sidebar-bottom"><div className="profile"><div className="profile-avatar">AR</div><div><b>Alex Rivera</b><small>Administrador</small></div><MoreHorizontal size={17} /></div></div>
      </aside>

      <section className="content-area">
        <header className="topbar"><div><p className="eyebrow">Martes, 18 de junio de 2024</p><h1>{active === 'Resumen' ? 'Buenos días, Alex' : active}</h1></div><div className="top-actions"><label className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar runs, rutas..." aria-label="Buscar runs" />{query && <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={14} /></button>}</label>{active === 'Chat' && <button className="icon-button" aria-label={sidebarOpen ? 'Ocultar panel' : 'Mostrar panel'} onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}</button>}<button className="icon-button" aria-label="Cambiar tema" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button><button className="icon-button notification" aria-label="Notificaciones" onClick={() => notify('Tienes 3 notificaciones nuevas')}><Bell size={18} /><i /></button><div className="top-avatar">AR</div></div></header>

        {active === 'Resumen' ? <>
        <div className="hero-card"><div><span className="pill pink-pill">Resumen operativo <Activity size={13} /></span><h2>Todo bajo control.</h2><p>Tu red está funcionando al <strong>94%</strong> de capacidad. Hay 3 decisiones que requieren tu atención.</p><button className="primary-button" onClick={() => { setActive('Incidencias'); notify('Mostrando incidencias prioritarias') }}>Revisar decisiones <ChevronRight size={15} /></button></div><div className="hero-art"><div className="route-line line-one" /><div className="route-line line-two" /><Truck size={84} strokeWidth={1.2} /><span className="map-pin pin-one" /><span className="map-pin pin-two" /></div></div>

        <div className="metric-grid"><div className="metric-card"><div className="metric-icon pink-icon"><Truck size={17} /></div><div><span>Runs activos</span><strong>23</strong><small className="positive">+12% <span>vs. semana pasada</span></small></div></div><div className="metric-card"><div className="metric-icon violet-icon"><Clock3 size={17} /></div><div><span>ETA medio</span><strong>36h</strong><small className="positive">-8% <span>más rápido</span></small></div></div><div className="metric-card"><div className="metric-icon blue-icon"><WalletCards size={17} /></div><div><span>Coste / km</span><strong>0,84€</strong><small className="positive">-4,2% <span>este mes</span></small></div></div><div className="metric-card score-card"><div className="score-ring"><span>94<small>%</small></span></div><div><span>Salud de la red</span><strong>Excelente</strong><small>2 alertas leves</small></div></div></div>

        <div className="dashboard-grid"><div className="panel activity-panel"><div className="panel-heading"><div><p className="section-kicker">Rendimiento</p><h3>Actividad de runs</h3></div><button className="filter-button" onClick={() => notify('Filtro de actividad aplicado')}><Filter size={14} /> Esta semana</button></div><div className="chart-wrap"><div className="y-axis"><span>30</span><span>20</span><span>10</span><span>0</span></div><svg className="line-chart" viewBox="0 0 600 190" preserveAspectRatio="none" role="img" aria-label="Gráfico de actividad semanal"><path className="chart-area" d="M0,148 C40,125 54,48 90,88 S145,142 184,103 S240,36 275,76 S321,138 360,105 S410,62 440,93 S495,153 525,112 S560,48 600,63 V190 H0 Z" /><path className="chart-line" d="M0,148 C40,125 54,48 90,88 S145,142 184,103 S240,36 275,76 S321,138 360,105 S410,62 440,93 S495,153 525,112 S560,48 600,63" /></svg></div><div className="chart-labels"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div></div>
          <div className="panel cost-panel"><div className="panel-heading"><div><p className="section-kicker">Finanzas</p><h3>Coste operativo</h3></div><button className="dots-button" onClick={() => notify('Más opciones de finanzas')}><MoreHorizontal size={18} /></button></div><p className="big-number">13.840€ <small>este mes</small></p><MiniBars /><div className="budget-line"><span>Presupuesto mensual</span><b>72%</b></div><div className="progress"><span style={{ width: '72%' }} /></div></div>
          <div className="panel runs-panel"><div className="panel-heading"><div><p className="section-kicker">Seguimiento</p><h3>Runs recientes</h3></div><button className="text-button" onClick={() => setShowAll(!showAll)}>{showAll ? 'Ver menos' : 'Ver todos'} <ChevronRight size={14} /></button></div><div className="run-list">{filteredRuns.slice(0, showAll ? 3 : 2).map((run) => <button className="run-row" key={run.id} onClick={() => notify(`${run.id} seleccionado`)}><span className={`run-icon ${run.tone}`}><Truck size={16} /></span><span className="run-info"><b>{run.route}</b><small>{run.id} · {run.carrier}</small></span><span className={`status ${run.tone}`}>{run.status}</span><span className="run-eta">{run.eta}</span><ChevronRight size={15} /></button>)}</div></div>
          <FleetMap />
          <div className="panel calendar-panel"><div className="panel-heading"><div><p className="section-kicker">Planificación</p><h3>Próximas salidas</h3></div><button className="dots-button" onClick={() => notify('Calendario abierto')}><CalendarDays size={17} /></button></div><div className="calendar-date"><strong>JUN</strong><b>18</b><span>Martes</span></div><div className="departure"><span className="time">09:20</span><div><b>Valencia → Lisboa</b><small>2 vehículos · Seur</small></div><span className="status violet">En 4h</span></div><div className="departure"><span className="time">13:00</span><div><b>Bilbao → París</b><small>1 vehículo · DB Schenker</small></div><span className="status amber">Mañana</span></div><button className="calendar-button" onClick={() => { setActive('Calendario'); notify('Calendario seleccionado') }}>Ver calendario completo <ChevronRight size={14} /></button></div>
        </div>
        </> : <ViewScreen active={active} onNotify={notify} />}
      </section>
      <button className="floating-chat" aria-label="Abrir chatbot de IA" onClick={() => { setActive('Chat'); setMobileOpen(false); notify('Chat con route.pilot AI abierto') }}><Sparkles size={19} /><span>Chat IA</span></button>
      {notice && <div className="toast"><Sparkles size={15} />{notice}</div>}
    </main>
  )
}

export default function Page() { return <App /> }
