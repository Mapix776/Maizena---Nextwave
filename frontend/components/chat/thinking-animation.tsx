'use client'

import { FileText, LineChart, Sparkles } from 'lucide-react'

export type ThinkingAnimationType = 'thinking' | 'reading' | 'drawing'

export function ThinkingAnimation({ type = 'thinking' }: { type?: ThinkingAnimationType }) {
  if (type === 'reading') return <div className="animation-visual document-animation" aria-hidden="true"><FileText size={26} /><span className="document-line line-one" /><span className="document-line line-two" /><span className="document-line line-three" /><span className="document-scan" /></div>
  if (type === 'drawing') return <div className="animation-visual chart-animation" aria-hidden="true"><span className="chart-axis axis-x" /><span className="chart-axis axis-y" /><span className="chart-bar bar-one" /><span className="chart-bar bar-two" /><span className="chart-bar bar-three" /><span className="chart-bar bar-four" /></div>
  return <div className="animation-visual thinking-animation" aria-hidden="true"><span className="thinking-orbit orbit-one" /><span className="thinking-orbit orbit-two" /><Sparkles size={28} /><span className="thinking-dot dot-one" /><span className="thinking-dot dot-two" /><span className="thinking-dot dot-three" /></div>
}
