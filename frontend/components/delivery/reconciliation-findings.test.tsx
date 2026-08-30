import assert from 'node:assert/strict'
import test from 'node:test'

import { renderToStaticMarkup } from 'react-dom/server'

import { ReconciliationFindings } from './reconciliation-findings'

test('ReconciliationFindings renders an evidence-backed document comparison', () => {
  const html = renderToStaticMarkup(
    <ReconciliationFindings
      status="discrepancy"
      severity="critical"
      discrepancies={[
        {
          field: 'containerNumber',
          severity: 'critical',
          values: {
            billOfLading: 'MSCU1234567',
            commercialInvoice: 'MSCU1234567',
            packingList: 'TGHU7654321',
          },
        },
      ]}
      evidenceIds={['reconciliation-tool-result']}
    />,
  )

  assert.match(html, /Document reconciliation/)
  assert.match(html, /Container number/)
  assert.match(html, /MSCU1234567/)
  assert.match(html, /TGHU7654321/)
  assert.match(html, /1 evidence source recorded/)
});

test('ReconciliationFindings renders the matched state without discrepancy rows', () => {
  const html = renderToStaticMarkup(
    <ReconciliationFindings
      status="matched"
      severity="normal"
      discrepancies={[]}
      evidenceIds={['reconciliation-tool-result']}
    />,
  )

  assert.match(html, /All compared fields match/)
  assert.doesNotMatch(html, /<table/)
});
