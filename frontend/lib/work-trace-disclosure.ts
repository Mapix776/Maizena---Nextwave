export interface DisclosureState {
  open: boolean
  manuallyClosedLive: boolean
  terminalCollapsed: boolean
}

export type DisclosureAction =
  | { type: 'manual-toggle' }
  | { type: 'trace-status'; status: 'running' | 'completed' | 'failed' }

export function createDisclosureState(
  status: 'running' | 'completed' | 'failed',
): DisclosureState {
  return {
    open: status === 'running',
    manuallyClosedLive: false,
    terminalCollapsed: status !== 'running',
  }
}

export function reduceDisclosureState(
  state: DisclosureState,
  action: DisclosureAction,
): DisclosureState {
  if (action.type === 'manual-toggle') {
    const open = !state.open
    return {
      ...state,
      open,
      manuallyClosedLive: open ? false : !state.terminalCollapsed,
    }
  }
  if (action.status === 'running') {
    return state.manuallyClosedLive ? state : { ...state, open: true }
  }
  if (state.terminalCollapsed) return state
  return { ...state, open: false, terminalCollapsed: true }
}

export function selectAnimatedStepId(
  steps: Array<{
    id: string
    stepNumber: number
    status: 'running' | 'completed' | 'failed'
  }>,
): string | undefined {
  return steps
    .filter(({ status }) => status === 'running')
    .reduce<undefined | { id: string; stepNumber: number }>(
      (selected, step) =>
        !selected || step.stepNumber > selected.stepNumber ? step : selected,
      undefined,
    )?.id
}
