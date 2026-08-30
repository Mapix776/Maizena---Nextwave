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

interface ChartData {
  title: string;
  chartType: 'bar' | 'line' | 'pie';
  data: Array<{ label: string; value: number }>;
  description?: string;
}

export function composeRunUi(result: StepResult): unknown {
  const assistantResponse = result.factPatch?.assistantResponse;
  const text =
    typeof assistantResponse === 'string' ? assistantResponse : result.summary;

  const humanDecision = result.factPatch?.humanDecision as HumanDecisionData | undefined;

  const chart = result.factPatch?.chart as ChartData | undefined;
  const elements: Record<string, { type: string; props: Record<string, unknown>; children: string[] }> = {
    'assistant-message': {
      type: 'AssistantMessage',
      props: { text },
      children: [],
    },
  };

  if (humanDecision) {
    elements['decision-card'] = {
          type: 'HumanDecisionCard',
          props: {
            title: humanDecision.title,
            question: humanDecision.question,
            severity: humanDecision.severity ?? 'normal',
            options: humanDecision.options,
          },
          children: [],
        };
    elements['assistant-message'].children.push('decision-card');
  }

  if (chart) {
    elements['interactive-chart'] = {
      type: 'InteractiveChart',
      props: chart,
      children: [],
    };
    elements['assistant-message'].children.push('interactive-chart');
  }

  // Case 2: shipment tracking, optionally composed with decisions and analytics.
  const hasDelivery = Boolean(result.factPatch?.deliveryId || result.factPatch?.fixtureId);
  if (hasDelivery) {
    const deliveryId = (result.factPatch?.deliveryId as string) || 'OP-2026-101';
    const from = (result.factPatch?.from as string) || 'Shanghai';
    const to = (result.factPatch?.to as string) || 'Manzanillo';
    const transportType = ((result.factPatch?.transportType as 'Sea' | 'Land') || 'Sea');
    const status = ((result.factPatch?.status as ContainerStatus) || 'In Transit');
    const deliveryTime = (result.factPatch?.deliveryTime as string) || '10 days';
    const issue = result.factPatch?.issue as string | undefined;
    const cardComponent = issue ? 'DeliveryIssueCard' : 'DeliveryCard';
    elements['delivery-card'] = {
      type: cardComponent,
      props: {
        id: deliveryId,
        from,
        to,
        transportType,
        status,
        createdAt: new Date().toISOString(),
        deliveryTime,
        ...(issue ? { issue } : {}),
      },
      children: issue ? [] : ['container-progress'],
    };
    if (!issue) {
      elements['container-progress'] = {
        type: 'ContainerProgress',
        props: { currentStatus: status },
        children: [],
      };
    }
    elements['assistant-message'].children.push('delivery-card');
  }

  // A valid response always emits one catalog-bound tree. Its children adapt to intent.
  return {
    root: 'assistant-message',
    elements,
  };
}
