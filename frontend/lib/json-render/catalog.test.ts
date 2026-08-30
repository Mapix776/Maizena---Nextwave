import assert from 'node:assert/strict'
import test from 'node:test'

import { tracerCatalog, validateTracerSpec } from '../../../backend/src/contracts/ui'
import { catalog, validateJsonRenderSpec } from './catalog'

test('the frontend catalog rejects unknown components and invalid component props', () => {
  const unknownComponent = {
    root: 'unknown',
    elements: {
      unknown: { type: 'UnknownComponent', props: {}, children: [] },
    },
  }
  const invalidOperation = {
    root: 'operation',
    elements: {
      operation: {
        type: 'OperationSummaryCard',
        props: { referenceCode: 'MISSING_REQUIRED_FIELDS' },
        children: [],
      },
    },
  }

  assert.throws(() => validateJsonRenderSpec(unknownComponent), /Invalid json-render tree/)
  assert.throws(() => validateJsonRenderSpec(invalidOperation), /Invalid props/)
});

test('the frontend catalog supports every component emitted by the backend', () => {
  const backendOnlyComponents = tracerCatalog.componentNames.filter(
    (componentName) => !catalog.componentNames.includes(componentName as never),
  )

  assert.deepEqual(backendOnlyComponents, [])
})

test('backend and frontend accept the same interactive component fixture', () => {
  const spec = {
    root: 'assistant-message',
    elements: {
      'assistant-message': {
        type: 'AssistantMessage',
        props: { text: 'Operational overview' },
        children: ['kpi-grid', 'comparison-table', 'step-progress-bar'],
      },
      'kpi-grid': {
        type: 'KpiGrid',
        props: {
          title: 'Network KPIs',
          metrics: [{ id: 'delays', label: 'Delayed', value: 2, severity: 'warning', trend: 'up' }],
        },
        children: [],
      },
      'comparison-table': {
        type: 'ComparisonTable',
        props: {
          title: 'Document comparison',
          documentAName: 'Bill of Lading',
          documentBName: 'Packing List',
          severity: 'warning',
          fields: [{ field: 'weight', label: 'Weight', valueA: 18050, valueB: 18200, status: 'discrepancy', diff: '150 kg' }],
        },
        children: [],
      },
      'step-progress-bar': {
        type: 'StepProgressBar',
        props: {
          title: 'Shipment itinerary',
          currentStepIndex: 1,
          totalSteps: 3,
          steps: [
            { id: 'origin', label: 'Origin', status: 'completed' },
            { id: 'transit', label: 'Transit', status: 'current' },
            { id: 'destination', label: 'Destination', status: 'pending' },
          ],
        },
        children: [],
      },
    },
  }

  assert.doesNotThrow(() => validateTracerSpec(spec))
  assert.doesNotThrow(() => validateJsonRenderSpec(spec))
})
