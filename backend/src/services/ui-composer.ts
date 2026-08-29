import type { StepResult } from '../contracts/step-result.js';

export function composeRunUi(result: StepResult): unknown {
  const assistantResponse = result.factPatch?.assistantResponse;
  const text =
    typeof assistantResponse === 'string' ? assistantResponse : result.summary;

  return {
    root: 'assistant-message',
    elements: {
      'assistant-message': {
        type: 'AssistantMessage',
        props: { text },
        children: ['delivery-card'],
      },
      'delivery-card': {
        type: 'DeliveryCard',
        props: {
          id: 'DEMO-2048',
          from: 'Cartagena',
          to: 'Bogotá',
          transportType: 'Land',
          status: 'In Transit',
          createdAt: '2026-08-29T20:00:00.000Z',
          deliveryTime: '6 hours',
        },
        children: ['container-progress'],
      },
      'container-progress': {
        type: 'ContainerProgress',
        props: { currentStatus: 'In Transit' },
        children: [],
      },
    },
  };
}
