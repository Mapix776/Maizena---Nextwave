import type { StepResult } from '../contracts/step-result.js';
import type { containerStatuses } from '../contracts/ui.js';

type ContainerStatus = (typeof containerStatuses)[number];

interface HumanDecisionData {
  title: string;
  question: string;
  severity?: 'normal' | 'warning' | 'critical';
  options: Array<{
    id: string;
    label: string;
    description: string;
    badge?: string;
    actionPayload?: string;
  }>;
}

export function composeRunUi(result: StepResult): unknown {
  const assistantResponse = result.factPatch?.assistantResponse;
  const text =
    typeof assistantResponse === 'string' ? assistantResponse : result.summary;

  const humanDecision = result.factPatch?.humanDecision as HumanDecisionData | undefined;

  // Caso 1: Decisión interactiva Human-in-the-Loop
  if (humanDecision) {
    return {
      root: 'assistant-message',
      elements: {
        'assistant-message': {
          type: 'AssistantMessage',
          props: { text },
          children: ['decision-card'],
        },
        'decision-card': {
          type: 'HumanDecisionCard',
          props: {
            title: humanDecision.title,
            question: humanDecision.question,
            severity: humanDecision.severity ?? 'normal',
            options: humanDecision.options,
          },
          children: [],
        },
      },
    };
  }

  // Caso 2: Visualización estándar de seguimiento de embarque
  const deliveryId = (result.factPatch?.deliveryId as string) || 'OP-2026-101';
  const from = (result.factPatch?.from as string) || 'Shanghai';
  const to = (result.factPatch?.to as string) || 'Manzanillo';
  const transportType = ((result.factPatch?.transportType as 'Sea' | 'Land') || 'Sea');
  const status = ((result.factPatch?.status as ContainerStatus) || 'In Transit');
  const deliveryTime = (result.factPatch?.deliveryTime as string) || '10 days';
  const issue = result.factPatch?.issue as string | undefined;

  const cardComponent = issue ? 'DeliveryIssueCard' : 'DeliveryCard';
  const cardProps = {
    id: deliveryId,
    from,
    to,
    transportType,
    status,
    createdAt: new Date().toISOString(),
    deliveryTime,
    ...(issue ? { issue } : {}),
  };

  return {
    root: 'assistant-message',
    elements: {
      'assistant-message': {
        type: 'AssistantMessage',
        props: { text },
        children: ['delivery-card'],
      },
      'delivery-card': {
        type: cardComponent,
        props: cardProps,
        children: ['container-progress'],
      },
      'container-progress': {
        type: 'ContainerProgress',
        props: { currentStatus: status },
        children: [],
      },
    },
  };
}
