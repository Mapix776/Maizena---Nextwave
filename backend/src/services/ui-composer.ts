import type { StepResult } from '../contracts/step-result.js';

export function composeRunUi(result: StepResult): unknown {
  const greeting = result.factPatch?.greeting;
  const deliveryId = typeof greeting === 'string' ? greeting : result.summary;

  return {
    root: 'delivery-card',
    elements: {
      'delivery-card': {
        type: 'DeliveryCard',
        props: {
          id: deliveryId,
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
