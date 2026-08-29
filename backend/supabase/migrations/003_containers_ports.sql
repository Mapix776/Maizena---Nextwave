-- Agregar columnas origin_port y destination_port a containers
-- (requeridas por ContainerRow en database.ts)
ALTER TABLE containers
  ADD COLUMN IF NOT EXISTS origin_port TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destination_port TEXT NOT NULL DEFAULT '';
