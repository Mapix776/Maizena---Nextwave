import assert from 'node:assert/strict'
import test from 'node:test'

import { isNaturalLanguageAssistantResponse } from './message-presentation.js'

test('Ari chrome is reserved for natural-language assistant responses', () => {
  assert.equal(
    isNaturalLanguageAssistantResponse({ role: 'assistant', text: 'Aquí tienes el resultado.' }),
    true,
  )
  assert.equal(
    isNaturalLanguageAssistantResponse({ role: 'assistant', text: '' }),
    false,
  )
  assert.equal(
    isNaturalLanguageAssistantResponse({ role: 'assistant', text: '   ' }),
    false,
  )
  assert.equal(
    isNaturalLanguageAssistantResponse({ role: 'user', text: 'Consulta' }),
    false,
  )
})
