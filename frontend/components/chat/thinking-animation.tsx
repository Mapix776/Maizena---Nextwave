'use client'

import { Clock3, FileText, LineChart, MapPin, Search, Sparkles, GitCompareArrows, Truck, Ship } from 'lucide-react'

export type ThinkingAnimationType = 'thinking' | 'reading' | 'drawing' | 'mapping' | 'finding' | 'findingBoat' | 'eta' | 'comparing'

export function ThinkingAnimation({ type = 'thinking' }: { type?: ThinkingAnimationType }) {
  if (type === 'reading') return <div className="animation-visual document-animation" aria-hidden="true"><FileText size={26} /><span className="document-line line-one" /><span className="document-line line-two" /><span className="document-line line-three" /><span className="document-scan" /></div>
  if (type === 'drawing') return <div className="animation-visual chart-animation" aria-hidden="true"><span className="chart-axis axis-x" /><span className="chart-axis axis-y" /><span className="chart-bar bar-one" /><span className="chart-bar bar-two" /><span className="chart-bar bar-three" /><span className="chart-bar bar-four" /></div>
  if (type === 'mapping') return <div className="animation-visual map-animation" aria-hidden="true"><span className="map-route route-one" /><span className="map-route route-two" /><span className="map-pulse map-pulse-one" /><span className="map-pulse map-pulse-two" /><MapPin size={25} /></div>
  if (type === 'finding') return <div className="animation-visual finding-animation" aria-hidden="true"><Truck size={30} /><span className="finding-scan" /><span className="finding-dot" /><span className="finding-container" /></div>
  if (type === 'findingBoat') return <div className="animation-visual finding-boat-animation" aria-hidden="true"><span className="boat-wave wave-one" /><span className="boat-wave wave-two" /><Ship size={31} /><span className="finding-container" /></div>
  if (type === 'eta') return <div className="animation-visual eta-animation" aria-hidden="true"><Clock3 size={27} /><span className="eta-hand" /></div>
  if (type === 'comparing') return <div className="animation-visual compare-animation" aria-hidden="true"><GitCompareArrows size={28} /><span className="compare-line compare-line-one" /><span className="compare-line compare-line-two" /></div>
  return <div className="animation-visual thinking-animation" aria-hidden="true"><span className="thinking-orbit orbit-one" /><span className="thinking-orbit orbit-two" /><Sparkles size={28} /><span className="thinking-dot dot-one" /><span className="thinking-dot dot-two" /><span className="thinking-dot dot-three" /></div>
}
