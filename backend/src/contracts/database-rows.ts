import { z } from 'zod';

import {
  CustomsLightSchema,
  DocumentPartyRoleSchema,
  DocumentRelationshipTypeSchema,
  DocumentTypeSchema,
} from './domain.js';

const jsonRecordSchema = z.record(z.string(), z.unknown());

export const operationRowSchema = z
  .object({
    id: z.string().min(1),
    client_name: z.string().min(1),
    reference_code: z.string().min(1),
    status: z.string().min(1),
    canonical_data: jsonRecordSchema,
    discrepancies: z.array(z.unknown()).nullable(),
    tags: z.array(z.string()).nullable(),
    notes: z.string().nullable(),
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const containerRowSchema = z
  .object({
    id: z.string().min(1),
    operation_id: z.string().min(1),
    container_number: z.string().min(1),
    container_type: z.string().nullable(),
    seal_number: z.string().nullable(),
    status: z.string().min(1),
    origin_port: z.string().nullable(),
    destination_port: z.string().nullable(),
    eta: z.string().datetime({ offset: true }).nullable(),
    original_eta: z.string().datetime({ offset: true }).nullable(),
    actual_arrival: z.string().datetime({ offset: true }).nullable(),
    current_location: z.string().nullable(),
    current_vessel: z.string().nullable(),
    transit_history: z.array(z.unknown()).nullable(),
    weight_kg: z.number().nonnegative().nullable(),
    declared_value_usd: z.number().nonnegative().nullable(),
    customs_light: CustomsLightSchema.nullable().optional(),
    previo_completed_at: z.string().datetime({ offset: true }).nullable().optional(),
    pedimento_number: z.string().nullable().optional(),
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const documentRowSchema = z
  .object({
    id: z.string().min(1),
    operation_id: z.string().min(1),
    type: DocumentTypeSchema,
    file_name: z.string().min(1),
    file_size: z.number().nonnegative().nullable(),
    mime_type: z.string().nullable(),
    document_reference: z.string().nullable(),
    storage_bucket: z.string().nullable(),
    storage_path: z.string().nullable(),
    raw_md: z.string(),
    extracted_json: jsonRecordSchema.nullable(),
    confidence_score: z.number().min(0).max(1).nullable(),
    processing_status: z.enum([
      'pending',
      'processing',
      'completed',
      'failed',
      'PENDING',
      'COMPLETED',
      'FAILED',
    ]),
    error_message: z.string().nullable(),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const documentPartyRowSchema = z
  .object({
    id: z.string().min(1),
    document_id: z.string().min(1),
    party_role: DocumentPartyRoleSchema,
    party_name: z.string().min(1),
    party_reference: z.string().nullable(),
    details_json: jsonRecordSchema,
    created_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const documentRelationshipRowSchema = z
  .object({
    id: z.string().min(1),
    source_document_id: z.string().min(1),
    target_document_id: z.string().min(1),
    relationship_type: DocumentRelationshipTypeSchema,
    details_json: jsonRecordSchema,
    created_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const eventRowSchema = z
  .object({
    id: z.string().min(1),
    run_id: z.string().nullable(),
    operation_id: z.string().min(1),
    severity: z.enum([
      'normal',
      'warning',
      'critical',
      'NORMAL',
      'WARNING',
      'CRITICAL',
    ]),
    category: z.string().min(1),
    title: z.string().min(1),
    message: z.string().min(1),
    details_json: jsonRecordSchema.nullable(),
    acknowledged: z.boolean(),
    acknowledged_by: z.string().nullable(),
    acknowledged_at: z.string().datetime({ offset: true }).nullable(),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const decisionRowSchema = z
  .object({
    id: z.string().min(1),
    run_id: z.string().min(1),
    operation_id: z.string().min(1),
    action_type: z.string().min(1),
    title: z.string().min(1),
    description: z.string().nullable(),
    severity: z.enum([
      'normal',
      'warning',
      'critical',
      'NORMAL',
      'WARNING',
      'CRITICAL',
    ]),
    execution_mode: z.enum([
      'auto',
      'requires_approval',
      'AUTO',
      'REQUIRE_APPROVAL',
    ]),
    default_action: z.unknown(),
    options_json: z.unknown(),
    question: z.string().nullable(),
    answer: z.string().nullable(),
    status: z.enum([
      'pending',
      'resolved',
      'auto_executed',
      'expired',
      'PENDING',
      'ACCEPTED',
      'REJECTED',
      'OVERRIDDEN',
      'EXPIRED',
    ]),
    auto_execute_at: z.string().datetime({ offset: true }).nullable(),
    context_snapshot: jsonRecordSchema.nullable(),
    user_response: z.unknown(),
    created_at: z.string().datetime({ offset: true }),
    resolved_at: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export const runRowSchema = z
  .object({
    id: z.string().min(1),
    operation_id: z.string().min(1),
    agent_name: z.string().min(1),
    flow_step: z.string().min(1),
    status: z.enum([
      'active',
      'completed',
      'failed',
      'waiting_decision',
      'RUNNING',
      'WAITING_INPUT',
      'COMPLETED',
      'FAILED',
    ]),
    context_json: jsonRecordSchema,
    trigger_event: z.string().nullable(),
    trigger_document_id: z.string().nullable(),
    tokens_used: z.number().int().nonnegative().nullable(),
    error_message: z.string().nullable(),
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const operationFullDetailsSchema = z
  .object({
    operation: operationRowSchema,
    containers: z.array(containerRowSchema),
    documents: z.array(documentRowSchema),
    events: z.array(eventRowSchema),
    decisions: z.array(decisionRowSchema),
    runs: z.array(runRowSchema),
    parties: z.array(documentPartyRowSchema),
    relationships: z.array(documentRelationshipRowSchema),
  })
  .strict();

export const operationsMetricsSummarySchema = z
  .object({
    totalOperations: z.number().int().nonnegative(),
    byStatus: z.record(z.string(), z.number().int().nonnegative()),
    totalContainers: z.number().int().nonnegative(),
    containersInTransit: z.number().int().nonnegative(),
    containersInCustoms: z.number().int().nonnegative(),
    delayedContainersCount: z.number().int().nonnegative(),
    criticalAlertsCount: z.number().int().nonnegative(),
    pendingDecisionsCount: z.number().int().nonnegative(),
  })
  .strict();

export const cargoItemSearchResultSchema = z
  .object({
    operationId: z.string().min(1),
    referenceCode: z.string().min(1),
    clientName: z.string().min(1),
    operationStatus: z.string().min(1),
    matchedItem: z
      .object({
        description: z.string().min(1),
        quantity: z.number().optional(),
        unitPriceUsd: z.number().optional(),
        sourceDocument: z.string().optional(),
        containerNumber: z.string().optional(),
      })
      .strict(),
    containers: z.array(
      z
        .object({
          containerNumber: z.string().min(1),
          status: z.string().min(1),
          currentLocation: z.string().nullable(),
          currentVessel: z.string().nullable(),
          originPort: z.string().nullable(),
          destinationPort: z.string().nullable(),
          eta: z.string().datetime({ offset: true }).nullable(),
          originalEta: z.string().datetime({ offset: true }).nullable(),
          actualArrival: z.string().datetime({ offset: true }).nullable(),
          customsLight: z.string().nullable().optional(),
        })
        .strict(),
    ),
    alerts: z.array(
      z
        .object({
          severity: z.string().min(1),
          title: z.string().min(1),
          message: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();

export const universalSearchResultSchema = z
  .object({
    operations: z.array(operationRowSchema),
    containers: z.array(containerRowSchema),
    documents: z.array(documentRowSchema),
    parties: z.array(documentPartyRowSchema),
    events: z.array(eventRowSchema),
    decisions: z.array(decisionRowSchema),
  })
  .strict();
