'use client'

type Party = { role?: string; name?: string; reference?: string }

function humanizeValue(value: string) {
  const sentence = value.replaceAll('_', ' ').replaceAll('-', ' ').trim()
  if (!sentence) return sentence
  return sentence[0].toUpperCase() + sentence.slice(1)
}

function humanizeKey(key: string) {
  return humanizeValue(key.replace(/([a-z])([A-Z])/g, '$1 $2'))
}

// Keys handled explicitly by the sheet layout, excluded from the generic grid.
const HANDLED_KEYS = new Set([
  'title', 'description', 'type', 'reference', 'parties', 'url', 'fileUrl',
  'mimeType', 'stored', 'fileName', 'errorMessage', 'confidence',
])

const SEAL_KEYS = ['customsStatus', 'processingStatus', 'status', 'clearanceStatus']

function isRed(value: string) {
  const v = value.toLowerCase()
  return v.includes('roj') || v.includes('red') || v.includes('reten') || v.includes('hold') || v.includes('fail')
}

export function DocumentSheetView({
  title,
  props,
}: {
  title: string
  props: Record<string, unknown>
}) {
  const docType = typeof props.type === 'string' ? humanizeValue(props.type) : title
  const reference = typeof props.reference === 'string' ? props.reference : undefined
  const fileName = typeof props.fileName === 'string' ? props.fileName : undefined
  const parties = Array.isArray(props.parties) ? (props.parties as Party[]) : []

  const detailEntries = Object.entries(props).filter(([key, value]) => {
    if (HANDLED_KEYS.has(key)) return false
    return typeof value === 'string' || typeof value === 'number'
  }) as Array<[string, string | number]>

  const sealKey = SEAL_KEYS.find((key) => typeof props[key] === 'string')
  const sealValue = sealKey ? String(props[sealKey]) : undefined

  return (
    <div className="doc-sheet" role="document" aria-label={`${docType} document sheet`}>
      <div className="doc-sheet-header">
        <p className="doc-sheet-brand">NAUTA FREIGHT &amp; CUSTOMS</p>
        <h4 className="doc-sheet-type">{docType.toUpperCase()}</h4>
      </div>

      {(reference || fileName) && (
        <div className="doc-sheet-refrow">
          {reference && <span><small>N° REF</small><b>{reference}</b></span>}
          {fileName && <span><small>ARCHIVO</small><b>{fileName}</b></span>}
        </div>
      )}

      {parties.length > 0 && (
        <div className="doc-sheet-parties">
          {parties.map((party, index) => (
            <div className="doc-sheet-party" key={`${party.role}-${index}`}>
              <small>{humanizeValue(party.role ?? 'Parte')}</small>
              <b>{party.name ?? '—'}</b>
              {party.reference && <span>{party.reference}</span>}
            </div>
          ))}
        </div>
      )}

      {detailEntries.length > 0 && (
        <dl className="doc-sheet-grid">
          {detailEntries.map(([key, value]) => (
            <div key={key}>
              <dt>{humanizeKey(key)}</dt>
              <dd>{typeof value === 'string' ? humanizeValue(value) : value}</dd>
            </div>
          ))}
        </dl>
      )}

      {sealValue && (
        <div className={`doc-sheet-seal ${isRed(sealValue) ? 'red' : 'green'}`}>
          SELLO ADUANAL: {humanizeValue(sealValue).toUpperCase()}
        </div>
      )}
    </div>
  )
}
