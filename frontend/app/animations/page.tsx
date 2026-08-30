'use client'

import { useState } from 'react'
import { Clock3, FileText, GitCompareArrows, LineChart, MapPin, Search, Sparkles } from 'lucide-react'
import { ThinkingAnimation, type ThinkingAnimationType } from '@/components/chat/thinking-animation'

const states: { key: ThinkingAnimationType; label: string; title: string; description: string; icon: typeof Sparkles }[] = [
  { key: 'thinking', label: 'Pensando', title: 'Ari está razonando', description: 'Organizando la respuesta y preparando los siguientes pasos.', icon: Sparkles },
  { key: 'reading', label: 'Leyendo documento', title: 'Ari está leyendo', description: 'Extrayendo los datos importantes del documento adjunto.', icon: FileText },
  { key: 'drawing', label: 'Dibujando gráficas', title: 'Ari está construyendo', description: 'Transformando los datos en una visualización clara.', icon: LineChart },
  { key: 'mapping', label: 'Ubicando en el mapa', title: 'Ari está ubicando', description: 'Siguiendo la ruta y localizando los puntos del envío.', icon: MapPin },
  { key: 'finding', label: 'Encontrando container', title: 'Ari está buscando', description: 'Consultando el inventario para encontrar el container correcto.', icon: Search },
  { key: 'eta', label: 'Calculando ETA', title: 'Ari está calculando', description: 'Estimando la llegada con la ruta y el tráfico actuales.', icon: Clock3 },
  { key: 'comparing', label: 'Comparando datos', title: 'Ari está comparando', description: 'Contrastando métricas para encontrar la mejor lectura.', icon: GitCompareArrows },
]

export default function AnimationsPage() {
  const [active, setActive] = useState(0)
  const [showResponse, setShowResponse] = useState(false)
  const state = states[active]
  const Icon = state.icon
  return <main className="animations-page"><div className="animations-shell"><header className="animations-header"><p className="animations-eyebrow">route.pilot / animations</p><h1>Estados de trabajo del chat</h1><p>Animaciones temporales para acompañar el trabajo de Ari antes de mostrar la respuesta final. Selecciona un estado para previsualizarlo.</p></header><div className="animation-tabs" role="tablist" aria-label="Estados del chat">{states.map((item, index) => <button type="button" role="tab" aria-selected={active === index} className={active === index ? 'selected' : ''} onClick={() => { setActive(index); setShowResponse(false) }} key={item.key}><item.icon size={15} />{item.label}</button>)}</div><section className="animation-stage" aria-live="polite"><div className="animation-stage-glow" /><ThinkingAnimation type={state.key} /><div className="animation-copy"><span className="animation-status"><Icon size={14} /> En progreso</span><h2>{state.title}</h2><p>{state.description}</p><div className="thinking-progress"><span /></div></div></section><button type="button" className="animation-response-button" onClick={() => setShowResponse(true)}>Mostrar respuesta final</button>{showResponse && <section className="animation-response" role="status"><div className="response-avatar"><Sparkles size={17} /></div><div><small>Ari</small><p>He terminado de analizar la información. Aquí tienes la respuesta con los componentes preparados.</p></div></section>}<p className="animations-note">Vista previa aislada · Estos estados están listos para conectarse al flujo real del chat.</p></div></main>
}
