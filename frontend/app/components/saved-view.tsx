'use client'

import type { Spec } from '@json-render/core'
import { Bookmark, BookmarkX, Sparkles } from 'lucide-react'
import { JsonRenderClient } from '@/app/json-render/render-client'
import type { getTranslations } from '@/lib/i18n'
import type { SavedSpec } from '@/lib/use-saved-specs'

export default function SavedView({
  savedSpecs,
  onRemove,
  onNotify,
  onGoToChat,
  t,
  dateLocale,
}: {
  savedSpecs: SavedSpec[]
  onRemove: (id: string) => void
  onNotify: (message: string) => void
  onGoToChat: () => void
  t: ReturnType<typeof getTranslations>
  dateLocale: string
}) {
  return (
    <div className="view-screen saved-screen">
      <div className="view-heading">
        <div>
          <p className="section-kicker">{t.savedKicker}</p>
          <h2>{t.savedNav}</h2>
          <p>{t.savedDescription}</p>
        </div>
        <button className="primary-button" onClick={onGoToChat}>
          <Sparkles size={15} /> {t.chat}
        </button>
      </div>

      {savedSpecs.length === 0 ? (
        <div className="saved-empty">
          <span className="saved-empty-icon"><Bookmark size={26} /></span>
          <h3>{t.savedEmptyTitle}</h3>
          <p>{t.savedEmptyText}</p>
        </div>
      ) : (
        <div className="saved-grid">
          {savedSpecs.map((item) => (
            <article className="saved-card" key={item.id}>
              <header className="saved-card-head">
                <div>
                  <b>{item.title}</b>
                  <small>
                    {new Intl.DateTimeFormat(dateLocale, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(item.savedAt))}
                  </small>
                </div>
                <button
                  type="button"
                  className="saved-remove"
                  aria-label={t.removeSaved}
                  onClick={() => {
                    onRemove(item.id)
                    onNotify(t.removeSavedDone)
                  }}
                >
                  <BookmarkX size={16} />
                </button>
              </header>
              <div className="saved-card-body">
                <JsonRenderClient spec={item.spec as Spec} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
