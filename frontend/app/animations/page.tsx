'use client'

import { useEffect, useState } from 'react'
import { FileText, LineChart, Sparkles } from 'lucide-react'

const states = [
  { key: 'thinking', label: 'Pensando', title: 'Ari está razonando', description: 'Organizando la respuesta y preparando los siguientes pasos.', icon: Sparkles },
  { key: 'reading', label: 'Leyendo documento', title: 'Ari está leyendo', description: 'Extrayendo los datos importantes del documento adjunto.', icon: FileText },
  { key: 'drawing', label: 'Dibujando gráficas', title: 'Ari está construyendo', description: 'Transformando los datos en una visualización clara.', icon: LineChart },
] as const

function ThinkingAnimation({ type }: { type: (typeof states)[number]['key'] }) {
  if (type === 'reading') return <div className="animation-visual document-animation" aria-hidden="true"><FileText size={28} /><span className="document-line line-one" /><span className="document-line line-two" /><span className="document-line line-three" /><span className="document-scan" /></div>
  if (type === 'drawing') return <div className="animation-visual chart-animation" aria-hidden="true"><span className="chart-axis axis-x" /><span className="chart-axis axis-y" /><span className="chart-bar bar-one" /><span className="chart-bar bar-two" /><span className="chart-bar bar-three" /><span className="chart-bar bar-four" /></div>
  return <div className="animation-visual thinking-animation" aria-hidden="true"><span className="thinking-orbit orbit-one" /><span className="thinking-orbit orbit-two" /><Sparkles size={30} /><span className="thinking-dot dot-one" /><span className="thinking-dot dot-two" /><span className="thinking-dot dot-three" /></div>
}

export default function AnimationsPage() {
  const [active, setActive] = useState(0)
  const [showResponse, setShowResponse] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => setActive((current) => (current + 1) % states.length), 3600)
    return () => window.clearInterval(timer)
  }, [])

  const state = states[active]
  const Icon = state.icon

  return <main className="animations-page"><div className="animations-shell"><header className="animations-header"><p className="animations-eyebrow">route.pilot / animations</p><h1>Estados de pensamiento del chat</h1><p>Animaciones temporales para acompañar el trabajo de Ari antes de mostrar la respuesta final.</p></header><div className="animation-tabs" role="tablist" aria-label="Estados del chat">{states.map((item, index) => <button type="button" role="tab" aria-selected={active === index} className={active === index ? 'selected' : ''} onClick={() => { setActive(index); setShowResponse(false) }} key={item.key}><item.icon size={15} />{item.label}</button>)}</div><section className="animation-stage" aria-live="polite"><div className="animation-stage-glow" /><ThinkingAnimation type={state.key} /><div className="animation-copy"><span className="animation-status"><Icon size={14} /> En progreso</span><h2>{state.title}</h2><p>{state.description}</p><div className="thinking-progress"><span /></div></div></section><button type="button" className="animation-response-button" onClick={() => setShowResponse(true)}>Mostrar respuesta final</button>{showResponse && <section className="animation-response" role="status"><div className="response-avatar"><Sparkles size={17} /></div><div><small>Ari</small><p>He terminado de analizar la información. Aquí tienes la respuesta con los componentes preparados.</p></div></section>}<p className="animations-note">Vista previa aislada · Próximo paso: conectar estos estados al flujo real del chat.</p></div></main>
}
