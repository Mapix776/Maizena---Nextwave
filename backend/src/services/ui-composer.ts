import type { StepResult } from '../contracts/step-result.js';

export function composeRunUi(result: StepResult): unknown {
  const greeting = result.factPatch?.greeting;

  return {
    root: 'run-result',
    elements: {
      'run-result': {
        type: 'Stack',
        props: { gap: 'md' },
        children: ['run-title', 'run-greeting'],
      },
      'run-title': {
        type: 'Heading',
        props: { text: 'Nauta engine tracer' },
        children: [],
      },
      'run-greeting': {
        type: 'Text',
        props: {
          text: typeof greeting === 'string' ? greeting : result.summary,
          tone: 'success',
        },
        children: [],
      },
    },
  };
}
