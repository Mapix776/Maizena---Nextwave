export const ARI_PROMPT_REQUESTED_EVENT = 'nauta:prompt-requested'

export interface AriPromptRequestedDetail {
  prompt: string
}

export function requestAriPrompt(prompt: string) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<AriPromptRequestedDetail>(ARI_PROMPT_REQUESTED_EVENT, {
      detail: { prompt },
    }),
  )
}
