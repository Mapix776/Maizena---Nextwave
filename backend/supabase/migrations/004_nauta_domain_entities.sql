-- =============================================================================
-- NAUTA LOGISTICS DOMAIN ENHANCEMENTS & SCHEMA REFINEMENTS
-- Based on docs/dominio-logistica-nauta.md
-- =============================================================================

-- 1. Actualizar ENUM document_type con tipos faltantes (PO, Pedimento, Previo, Revalidación, etc.)
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'PURCHASE_ORDER';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'PEDIMENTO';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'BL_REVALIDATION';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'PREVIO_REPORT';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'EXPENSE_ACCOUNT';

-- 2. Refinar tabla 'containers' con campos aduaneros críticos
-- - customs_light: Semáforo aduanero ('green' = desaduanamiento libre, 'red' = revisión física obligatoria)
-- - previo_completed_at: Registro de cuándo terminó la inspección física en operadora portuaria (1-3 hrs)
ALTER TABLE containers
  ADD COLUMN IF NOT EXISTS origin_port TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destination_port TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customs_light TEXT CHECK (customs_light IN ('green', 'red', 'pending') OR customs_light IS NULL),
  ADD COLUMN IF NOT EXISTS previo_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pedimento_number TEXT;

-- 3. Índices para acelerar búsquedas operativas y de semáforo aduanero
CREATE INDEX IF NOT EXISTS idx_containers_customs_light ON containers(customs_light);
CREATE INDEX IF NOT EXISTS idx_containers_pedimento     ON containers(pedimento_number);

-- 4. Comentarios explicativos en las tablas para el equipo
COMMENT ON COLUMN containers.customs_light IS 'Resultado del semáforo fiscal aduanero: green (desaduanamiento libre) o red (reconocimiento aduanero con revisión física)';
COMMENT ON COLUMN containers.previo_completed_at IS 'Fecha/hora de culminación de la revisión física previa ante la operadora portuaria';
COMMENT ON COLUMN containers.pedimento_number IS 'Número oficial del pedimento aduanero validado y pagado';
