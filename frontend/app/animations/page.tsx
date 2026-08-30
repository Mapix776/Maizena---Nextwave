'use client'

import { useState } from 'react'
import { Clock3, FileText, GitCompareArrows, LineChart, MapPin, Search, Ship, Sparkles } from 'lucide-react'
import { ThinkingAnimation, type ThinkingAnimationType } from '@/components/chat/thinking-animation'

const states: { key: ThinkingAnimationType; label: string; title: string; description: string; icon: typeof Sparkles }[] = [
  { key: 'thinking', label: 'Thinking', title: 'Ari is reasoning', description: 'Organizing the response and preparing the next steps.', icon: Sparkles },
  { key: 'reading', label: 'Reading document', title: 'Ari is reading', description: 'Extracting the important data from the attached document.', icon: FileText },
  { key: 'drawing', label: 'Drawing charts', title: 'Ari is building', description: 'Turning the data into a clear visualization.', icon: LineChart },
  { key: 'mapping', label: 'Locating on the map', title: 'Ari is locating', description: 'Following the route and locating the shipment points.', icon: MapPin },
  { key: 'finding', label: 'Finding container', title: 'Ari is searching', description: 'Querying the inventory to find the right container.', icon: Search },
  { key: 'findingBoat', label: 'Container by vessel', title: 'Ari is navigating', description: 'Following the vessel to locate the container en route.', icon: Ship },
  { key: 'eta', label: 'Calculating ETA', title: 'Ari is calculating', description: 'Estimating arrival with the current route and traffic.', icon: Clock3 },
  { key: 'comparing', label: 'Comparing data', title: 'Ari is comparing', description: 'Contrasting metrics to find the best reading.', icon: GitCompareArrows },
]

export default function AnimationsPage() {
  const [active, setActive] = useState(0)
  const [showResponse, setShowResponse] = useState(false)
  const state = states[active]
  const Icon = state.icon
  return <main className="animations-page"><div className="animations-shell"><header className="animations-header"><p className="animations-eyebrow">route.pilot / animations</p><h1>Chat working states</h1><p>Temporary animations to accompany Ari&apos;s work before showing the final response. Select a state to preview it.</p></header><div className="animation-tabs" role="tablist" aria-label="Chat states">{states.map((item, index) => <button type="button" role="tab" aria-selected={active === index} className={active === index ? 'selected' : ''} onClick={() => { setActive(index); setShowResponse(false) }} key={item.key}><item.icon size={15} />{item.label}</button>)}</div><section className="animation-stage" aria-live="polite"><div className="animation-stage-glow" /><ThinkingAnimation type={state.key} /><div className="animation-copy"><span className="animation-status"><Icon size={14} /> In progress</span><h2>{state.title}</h2><p>{state.description}</p><div className="thinking-progress"><span /></div></div></section><button type="button" className="animation-response-button" onClick={() => setShowResponse(true)}>Show final response</button>{showResponse && <section className="animation-response" role="status"><div className="response-avatar"><Sparkles size={17} /></div><div><small>Ari</small><p>I&apos;ve finished analyzing the information. Here is the response with the prepared components.</p></div></section>}<p className="animations-note">Isolated preview · These states are ready to connect to the real chat flow.</p></div></main>
}
