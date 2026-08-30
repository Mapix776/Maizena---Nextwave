export function isNaturalLanguageAssistantResponse(message: {
  role: 'user' | 'assistant'
  text: string
}): boolean {
  return message.role === 'assistant' && message.text.trim().length > 0
}
