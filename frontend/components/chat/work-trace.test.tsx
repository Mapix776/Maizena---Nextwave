import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { renderToStaticMarkup } from 'react-dom/server'

import { openWorkTraceSource, WorkTraceDisclosure } from './work-trace'

const steps = [
  {
    id: 'trace-step-1',
    stepNumber: 1,
    kind: 'thinking' as const,
    status: 'running' as const,
    animationType: 'thinking' as const,
    title: 'Preparando',
    detail: 'Organizando la solicitud.',
  },
  {
    id: 'trace-step-2',
    stepNumber: 2,
    kind: 'querying_database' as const,
    status: 'running' as const,
    animationType: 'findingBoat' as const,
    title: 'Consultando',
    detail: 'Consultando información operativa.',
  },
]

test('the live trace renders one decorative animation and one persistent atomic status node', () => {
  const markup = renderToStaticMarkup(
    <WorkTraceDisclosure
      trace={{ status: 'running', durationMs: 25, steps }}
      workedForLabel="Trabajó durante"
      workingLabel="Pensando"
    />,
  )

  assert.equal(markup.match(/animation-visual/g)?.length, 1)
  assert.equal(markup.match(/role="status"/g)?.length, 1)
  assert.match(markup, /aria-atomic="true"/)
  assert.match(markup, /aria-expanded="true"/)
})

test('the conversation log is not live while each Work trace owns one atomic status node', () => {
  const agentBuilderSource = readFileSync(
    new URL('../../app/components/agent-builder.tsx', import.meta.url),
    'utf8',
  )
  const conversationOpeningTag = agentBuilderSource.match(/<Conversation\b[^>]*>/)
  assert.ok(conversationOpeningTag)
  assert.doesNotMatch(conversationOpeningTag[0], /aria-live=/)

  const markup = renderToStaticMarkup(
    <WorkTraceDisclosure
      trace={{
        status: 'completed',
        durationMs: 25,
        steps: steps.map((step) => ({ ...step, status: 'completed' as const })),
      }}
      workedForLabel="Trabajó durante"
      workingLabel="Pensando"
    />,
  )
  assert.equal(markup.match(/role="status"/g)?.length, 1)
  assert.equal(markup.match(/aria-atomic="true"/g)?.length, 1)
})

test('terminal trace starts collapsed while its status node remains outside the hidden panel', () => {
  const markup = renderToStaticMarkup(
    <WorkTraceDisclosure
      trace={{
        status: 'completed',
        durationMs: 2_000,
        steps: steps.map((step) => ({ ...step, status: 'completed' })),
      }}
      workedForLabel="Trabajó durante"
      workingLabel="Pensando"
    />,
  )

  assert.match(markup, /aria-expanded="false"/)
  assert.ok(markup.indexOf('role="status"') < markup.indexOf('hidden=""'))
})

test('source controls render only when present and invoke the pane-opening seam', () => {
  const source = {
    id: 'trace-source-1' as const,
    title: 'Commercial Invoice.pdf',
    mimeType: 'application/pdf' as const,
    contentUrl: '/api/documents/11111111-1111-4111-8111-111111111111/content' as const,
  }
  const markup = renderToStaticMarkup(
    <WorkTraceDisclosure
      trace={{ status: 'completed', durationMs: 25, steps: [{ ...steps[0], status: 'completed', sources: [source] }] }}
      workedForLabel="Worked for"
      workingLabel="Working"
      sourcesLabel="Sources"
      onOpenSource={() => undefined}
    />,
  )
  assert.match(markup, /Sources/)
  assert.match(markup, /Commercial Invoice\.pdf/)
  const opened: unknown[] = []
  openWorkTraceSource(source, (value) => opened.push(value))
  assert.deepEqual(opened, [source])

  const withoutSources = renderToStaticMarkup(
    <WorkTraceDisclosure
      trace={{ status: 'completed', durationMs: 25, steps: [{ ...steps[0], status: 'completed' }] }}
      workedForLabel="Worked for"
      workingLabel="Working"
      sourcesLabel="Sources"
    />,
  )
  assert.doesNotMatch(withoutSources, /Sources/)
})
