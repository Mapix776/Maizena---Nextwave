-- =============================================================================
-- NAUTA OPERATIONAL BRAIN — Database Schema
-- =============================================================================
-- Ejecutar en Supabase SQL Editor en orden

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE operation_status AS ENUM (
  'BOOKED',
  'IN_TRANSIT',
  'AT_PORT',
  'CUSTOMS_CLEARANCE',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'EXCEPTION'
);

CREATE TYPE document_type AS ENUM (
  'BOOKING_CONFIRMATION',
  'BILL_OF_LADING',
  'COMMERCIAL_INVOICE',
  'PACKING_LIST',
  'CUSTOMS_DECLARATION',
  'EMAIL_UPDATE',
  'ARRIVAL_NOTICE',
  'DELIVERY_ORDER',
  'OTHER'
);

CREATE TYPE alert_severity AS ENUM (
  'NORMAL',
  'WARNING',
  'CRITICAL'
);

CREATE TYPE run_status AS ENUM (
  'RUNNING',
  'WAITING_INPUT',
  'COMPLETED',
  'FAILED'
);

CREATE TYPE decision_status AS ENUM (
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'OVERRIDDEN',
  'EXPIRED'
);

CREATE TYPE action_execution_mode AS ENUM (
  'AUTO',
  'REQUIRE_APPROVAL'
);

CREATE TYPE container_status AS ENUM (
  'EMPTY',
  'LOADED',
  'IN_TRANSIT',
  'AT_PORT',
  'CUSTOMS_HOLD',
  'RELEASED',
  'DELIVERED'
);

-- =============================================================================
-- TABLE: operations
-- Operacion logistica principal — 1 operacion = 1 embarque
-- =============================================================================

CREATE TABLE operations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_name         TEXT NOT NULL,
  reference_code      TEXT UNIQUE NOT NULL,
  status              operation_status NOT NULL DEFAULT 'BOOKED',
  canonical_data      JSONB NOT NULL DEFAULT '{}',
  discrepancies       JSONB NOT NULL DEFAULT '[]',
  tags                TEXT[] DEFAULT '{}',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_operations_status    ON operations(status);
CREATE INDEX idx_operations_client    ON operations(client_name);
CREATE INDEX idx_operations_ref       ON operations(reference_code);
CREATE INDEX idx_operations_canonical ON operations USING GIN(canonical_data);

-- =============================================================================
-- TABLE: documents
-- =============================================================================

CREATE TABLE documents (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation_id        UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  type                document_type NOT NULL,
  file_name           TEXT NOT NULL,
  file_size           INTEGER,
  mime_type           TEXT,
  raw_md              TEXT NOT NULL,
  extracted_json      JSONB NOT NULL DEFAULT '{}',
  confidence_score    FLOAT DEFAULT 0,
  processing_status   TEXT NOT NULL DEFAULT 'PENDING',
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_operation ON documents(operation_id);
CREATE INDEX idx_documents_type      ON documents(type);
CREATE INDEX idx_documents_extracted ON documents USING GIN(extracted_json);

-- =============================================================================
-- TABLE: containers
-- =============================================================================

CREATE TABLE containers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation_id        UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  container_number    TEXT NOT NULL,
  container_type      TEXT,
  seal_number         TEXT,
  status              container_status NOT NULL DEFAULT 'LOADED',
  eta                 TIMESTAMPTZ,
  original_eta        TIMESTAMPTZ,
  actual_arrival      TIMESTAMPTZ,
  current_location    TEXT,
  current_vessel      TEXT,
  transit_history     JSONB NOT NULL DEFAULT '[]',
  weight_kg           FLOAT,
  declared_value_usd  FLOAT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(operation_id, container_number)
);

CREATE INDEX idx_containers_operation ON containers(operation_id);
CREATE INDEX idx_containers_status    ON containers(status);
CREATE INDEX idx_containers_eta       ON containers(eta);

-- =============================================================================
-- TABLE: runs
-- Ejecuciones de agentes con memoria de contexto
-- =============================================================================

CREATE TABLE runs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation_id        UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  agent_name          TEXT NOT NULL,
  flow_step           TEXT NOT NULL,
  status              run_status NOT NULL DEFAULT 'RUNNING',
  context_json        JSONB NOT NULL DEFAULT '{}',
  trigger_event       TEXT,
  trigger_document_id UUID REFERENCES documents(id),
  tokens_used         INTEGER DEFAULT 0,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_runs_operation ON runs(operation_id);
CREATE INDEX idx_runs_status    ON runs(status);
CREATE INDEX idx_runs_agent     ON runs(agent_name);

-- =============================================================================
-- TABLE: events
-- Alertas clasificadas normal / warning / critical
-- =============================================================================

CREATE TABLE events (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id              UUID REFERENCES runs(id) ON DELETE SET NULL,
  operation_id        UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  severity            alert_severity NOT NULL DEFAULT 'NORMAL',
  category            TEXT NOT NULL,
  title               TEXT NOT NULL,
  message             TEXT NOT NULL,
  details_json        JSONB DEFAULT '{}',
  acknowledged        BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by     TEXT,
  acknowledged_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_operation ON events(operation_id);
CREATE INDEX idx_events_run       ON events(run_id);
CREATE INDEX idx_events_severity  ON events(severity);
CREATE INDEX idx_events_created   ON events(created_at DESC);

-- =============================================================================
-- TABLE: decisions
-- Human-in-the-loop: acciones propuestas + respuesta del operador
-- =============================================================================

CREATE TABLE decisions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id              UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  operation_id        UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  action_type         TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  severity            alert_severity NOT NULL,
  execution_mode      action_execution_mode NOT NULL DEFAULT 'REQUIRE_APPROVAL',
  default_action      JSONB NOT NULL DEFAULT '{}',
  options_json        JSONB NOT NULL DEFAULT '[]',
  question            TEXT,
  answer              TEXT,
  status              decision_status NOT NULL DEFAULT 'PENDING',
  auto_execute_at     TIMESTAMPTZ,
  context_snapshot    JSONB DEFAULT '{}',
  user_response       JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ
);

CREATE INDEX idx_decisions_operation ON decisions(operation_id);
CREATE INDEX idx_decisions_run       ON decisions(run_id);
CREATE INDEX idx_decisions_status    ON decisions(status);

-- =============================================================================
-- TRIGGERS — updated_at automatico
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_operations_updated_at
  BEFORE UPDATE ON operations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_containers_updated_at
  BEFORE UPDATE ON containers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_runs_updated_at
  BEFORE UPDATE ON runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON operations  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON documents   FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON containers  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON runs        FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON events      FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON decisions   FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- SEED DATA (demo)
-- =============================================================================

INSERT INTO operations (id, client_name, reference_code, status) VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Importadora Atlantico S.A.',
  'OP-2026-001',
  'IN_TRANSIT'
);
