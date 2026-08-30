'use client'

import { JsonRenderClient } from './render-client'
import { catalogShowcase } from '@/lib/json-render/catalog-showcase'

export default function JsonRenderPage() {
  return (
    <main className="json-catalog-page">
      <div className="json-catalog-shell">
        <header className="json-catalog-header">
          <p className="json-catalog-eyebrow">route.pilot / json-render</p>
          <h1>Component catalog</h1>
          <p>All components registered in the official catalog, with their variants rendered from JSON specs.</p>
        </header>
        <section className="json-catalog-grid" aria-label="Component catalog">
          {catalogShowcase.map((item, index) => (
            <article className="json-catalog-card" key={item.name}>
              <div className="json-catalog-card-header">
                <div><span className="json-catalog-index">{String(index + 1).padStart(2, '0')}</span><h2>{item.name}</h2></div>
                <span className="json-catalog-badge">JSON</span>
              </div>
              <p className="json-catalog-description">{item.description}</p>
              <div className="json-catalog-preview"><JsonRenderClient spec={item.spec} /></div>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
