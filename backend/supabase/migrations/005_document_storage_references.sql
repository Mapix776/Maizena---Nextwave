-- =============================================================================
-- DOCUMENT STORAGE, REFERENCES, AND PARTIES
-- Store original documents in private Supabase Storage and make their business
-- references and involved parties queryable.
-- =============================================================================

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS document_reference TEXT,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Preserve storage references created before these columns existed.
UPDATE documents
SET
  storage_bucket = extracted_json ->> 'storage_bucket',
  storage_path = extracted_json ->> 'storage_path'
WHERE storage_path IS NULL
  AND extracted_json ? 'storage_path';

-- Promote the primary identifier of each known document type to a queryable
-- column. Other document types may leave document_reference NULL.
UPDATE documents
SET document_reference = CASE type::TEXT
  WHEN 'PURCHASE_ORDER' THEN extracted_json ->> 'purchase_order'
  WHEN 'BOOKING_CONFIRMATION' THEN extracted_json ->> 'booking_reference'
  WHEN 'BILL_OF_LADING' THEN extracted_json ->> 'bill_of_lading'
  WHEN 'PACKING_LIST' THEN extracted_json ->> 'invoice_packing_list'
  ELSE NULL
END
WHERE document_reference IS NULL;

ALTER TABLE documents
  ADD CONSTRAINT documents_storage_reference_complete
  CHECK (
    (storage_bucket IS NULL AND storage_path IS NULL)
    OR (storage_bucket IS NOT NULL AND storage_path IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_storage_object
  ON documents (storage_bucket, storage_path)
  WHERE storage_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_operation_storage
  ON documents (operation_id, storage_bucket, storage_path);
CREATE INDEX IF NOT EXISTS idx_documents_reference
  ON documents (document_reference)
  WHERE document_reference IS NOT NULL;

-- Parties are intentionally attached to a document (which already belongs to
-- one operation), avoiding duplicated and potentially inconsistent operation
-- references on every party row.
CREATE TABLE IF NOT EXISTS document_parties (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  party_role    TEXT NOT NULL CHECK (party_role IN (
    'ISSUER', 'BUYER', 'SUPPLIER', 'SHIPPER', 'CONSIGNEE', 'CARRIER', 'NOTIFY_PARTY'
  )),
  party_name    TEXT NOT NULL,
  party_reference TEXT,
  details_json  JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, party_role, party_name)
);

CREATE INDEX IF NOT EXISTS idx_document_parties_document
  ON document_parties (document_id);
CREATE INDEX IF NOT EXISTS idx_document_parties_name
  ON document_parties (party_name);

CREATE TABLE IF NOT EXISTS document_relationships (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  relationship_type   TEXT NOT NULL CHECK (relationship_type IN (
    'DISCREPANCY_WITH', 'SUPERSEDES', 'SUPPORTS', 'DERIVED_FROM'
  )),
  details_json        JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_document_id <> target_document_id),
  UNIQUE (source_document_id, target_document_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_document_relationships_source
  ON document_relationships (source_document_id);
CREATE INDEX IF NOT EXISTS idx_document_relationships_target
  ON document_relationships (target_document_id);

-- Import parties captured by prior document extraction runs. New uploads should
-- write the same data directly to document_parties.
INSERT INTO document_parties (
  document_id,
  party_role,
  party_name,
  party_reference,
  details_json
)
SELECT
  documents.id,
  party.party_role,
  party.party_name,
  party.party_reference,
  COALESCE(party.details_json, '{}'::JSONB)
FROM documents
CROSS JOIN LATERAL jsonb_to_recordset(
  COALESCE(documents.extracted_json -> 'parties', '[]'::JSONB)
) AS party(
  party_role TEXT,
  party_name TEXT,
  party_reference TEXT,
  details_json JSONB
)
WHERE party.party_role IS NOT NULL
  AND party.party_name IS NOT NULL
ON CONFLICT (document_id, party_role, party_name) DO NOTHING;

-- Import document-to-document relationships captured by prior extraction runs.
INSERT INTO document_relationships (
  source_document_id,
  target_document_id,
  relationship_type,
  details_json
)
SELECT
  documents.id,
  relationship.target_document_id::UUID,
  relationship.relationship_type,
  COALESCE(relationship.details_json, '{}'::JSONB)
FROM documents
CROSS JOIN LATERAL jsonb_to_recordset(
  COALESCE(documents.extracted_json -> 'document_relationships', '[]'::JSONB)
) AS relationship(
  target_document_id TEXT,
  relationship_type TEXT,
  details_json JSONB
)
WHERE relationship.target_document_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND relationship.relationship_type IN ('DISCREPANCY_WITH', 'SUPERSEDES', 'SUPPORTS', 'DERIVED_FROM')
ON CONFLICT (source_document_id, target_document_id, relationship_type) DO NOTHING;

ALTER TABLE document_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON document_parties
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE document_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON document_relationships
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON COLUMN documents.document_reference IS
  'Primary identifier printed on the document, e.g. PO, booking, B/L, or invoice/packing-list number.';
COMMENT ON COLUMN documents.storage_bucket IS
  'Private Supabase Storage bucket containing the original file.';
COMMENT ON COLUMN documents.storage_path IS
  'Object path: operations/{operation_id}/{document-type-folder}/{filename}.';
COMMENT ON TABLE document_parties IS
  'Parties named by a document. The document is associated to its operation through documents.operation_id.';
COMMENT ON TABLE document_relationships IS
  'Auditable relationships between two documents, such as a discrepancy or replacement.';
