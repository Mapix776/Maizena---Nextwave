-- Immutable custom-report source, bundle, and validation authority.
-- Storage object bytes are always mutated through the Storage API; this
-- migration only configures the private bucket and Postgres metadata.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'report-artifacts',
  'report-artifacts',
  FALSE,
  5242880,
  ARRAY[
    'application/json',
    'font/woff2',
    'image/png',
    'image/svg+xml',
    'image/webp',
    'text/css',
    'text/html',
    'text/javascript'
  ]::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE public.report_artifacts (
  id UUID PRIMARY KEY,
  operation_id UUID NOT NULL
    REFERENCES public.operations(id),
  kind TEXT NOT NULL DEFAULT 'custom_report'
    CHECK (kind = 'custom_report'),
  title TEXT NOT NULL
    CHECK (char_length(title) BETWEEN 1 AND 300),
  accepted_revision_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.report_artifact_revisions (
  id UUID PRIMARY KEY,
  artifact_id UUID NOT NULL
    REFERENCES public.report_artifacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL
    CHECK (status IN ('accepted', 'rejected')),
  request_id TEXT NOT NULL UNIQUE
    CHECK (char_length(request_id) BETWEEN 1 AND 128),
  storage_bucket TEXT NOT NULL
    CHECK (storage_bucket = 'report-artifacts'),
  storage_prefix TEXT NOT NULL UNIQUE
    CHECK (char_length(storage_prefix) BETWEEN 1 AND 500),
  source_manifest JSONB NOT NULL
    CHECK (
      jsonb_typeof(source_manifest) = 'array'
      AND jsonb_array_length(source_manifest) = 4
    ),
  bundle_manifest JSONB NOT NULL
    CHECK (
      jsonb_typeof(bundle_manifest) = 'array'
      AND jsonb_array_length(bundle_manifest) BETWEEN 1 AND 64
    ),
  screenshot_path TEXT NOT NULL
    CHECK (char_length(screenshot_path) BETWEEN 1 AND 600),
  template_alias TEXT NOT NULL
    CHECK (char_length(template_alias) BETWEEN 1 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  CONSTRAINT report_artifact_revisions_acceptance_time CHECK (
    (status = 'accepted' AND accepted_at IS NOT NULL)
    OR (status = 'rejected' AND accepted_at IS NULL)
  )
);

ALTER TABLE public.report_artifacts
  ADD CONSTRAINT report_artifacts_accepted_revision_fk
  FOREIGN KEY (accepted_revision_id)
  REFERENCES public.report_artifact_revisions(id)
  ON DELETE SET NULL;

CREATE INDEX report_artifacts_accepted_revision_idx
  ON public.report_artifacts(accepted_revision_id)
  WHERE accepted_revision_id IS NOT NULL;
CREATE INDEX report_artifacts_operation_idx
  ON public.report_artifacts(operation_id);
CREATE INDEX report_artifact_revisions_artifact_status_idx
  ON public.report_artifact_revisions(artifact_id, status);

ALTER TABLE public.report_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_artifact_revisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
  ON TABLE public.report_artifacts, public.report_artifact_revisions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT
  ON TABLE public.report_artifacts, public.report_artifact_revisions
  TO service_role;

CREATE OR REPLACE FUNCTION public.accept_report_artifact_revision(
  p_artifact_id UUID,
  p_revision_id UUID,
  p_request_id TEXT,
  p_source_reference TEXT,
  p_title TEXT,
  p_storage_bucket TEXT,
  p_storage_prefix TEXT,
  p_source_manifest JSONB,
  p_bundle_manifest JSONB,
  p_screenshot_path TEXT,
  p_template_alias TEXT
)
RETURNS TABLE (
  artifact_id UUID,
  revision_id UUID,
  title TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_expected_prefix TEXT;
  v_existing RECORD;
  v_operation_id UUID;
BEGIN
  IF p_artifact_id IS NULL OR p_revision_id IS NULL OR p_artifact_id = p_revision_id THEN
    RAISE EXCEPTION 'artifact and revision identifiers are required and distinct'
      USING ERRCODE = '22023';
  END IF;
  IF p_request_id IS NULL
    OR p_request_id <> btrim(p_request_id)
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'invalid request identifier' USING ERRCODE = '22023';
  END IF;
  IF p_source_reference IS NULL
    OR p_source_reference <> btrim(p_source_reference)
    OR char_length(p_source_reference) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid source reference' USING ERRCODE = '22023';
  END IF;
  IF p_title IS NULL
    OR p_title <> btrim(p_title)
    OR char_length(p_title) NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'invalid report title' USING ERRCODE = '22023';
  END IF;
  IF p_template_alias IS NULL
    OR p_template_alias <> btrim(p_template_alias)
    OR char_length(p_template_alias) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'invalid template alias' USING ERRCODE = '22023';
  END IF;
  IF p_storage_bucket IS DISTINCT FROM 'report-artifacts' THEN
    RAISE EXCEPTION 'invalid artifact bucket' USING ERRCODE = '22023';
  END IF;

  v_expected_prefix := format(
    'artifacts/%s/revisions/%s',
    p_artifact_id,
    p_revision_id
  );
  IF p_storage_prefix IS DISTINCT FROM v_expected_prefix THEN
    RAISE EXCEPTION 'invalid artifact storage prefix' USING ERRCODE = '22023';
  END IF;
  IF p_screenshot_path IS DISTINCT FROM
    v_expected_prefix || '/validation/browser.png' THEN
    RAISE EXCEPTION 'invalid validation screenshot path' USING ERRCODE = '22023';
  END IF;

  IF p_source_manifest IS NULL
    OR jsonb_typeof(p_source_manifest) <> 'array'
    OR jsonb_array_length(p_source_manifest) <> 4
    OR p_bundle_manifest IS NULL
    OR jsonb_typeof(p_bundle_manifest) <> 'array'
    OR jsonb_array_length(p_bundle_manifest) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'invalid artifact manifests' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_source_manifest || p_bundle_manifest) AS entry(value)
    WHERE jsonb_typeof(entry.value) <> 'object'
      OR NOT (entry.value ?& ARRAY['path', 'mimeType', 'bytes', 'sha256'])
      OR jsonb_typeof(entry.value -> 'path') <> 'string'
      OR jsonb_typeof(entry.value -> 'mimeType') <> 'string'
      OR jsonb_typeof(entry.value -> 'bytes') <> 'number'
      OR jsonb_typeof(entry.value -> 'sha256') <> 'string'
      OR (entry.value ->> 'path') !~ '^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$'
      OR (entry.value ->> 'path') ~ '(^|/)\.\.?(/|$)'
      OR char_length(entry.value ->> 'path') > 300
      OR (entry.value ->> 'mimeType') !~ '^[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+(; charset=utf-8)?$'
      OR (entry.value ->> 'bytes') !~ '^[0-9]+$'
      OR (entry.value ->> 'bytes')::NUMERIC > 5242880
      OR (entry.value ->> 'sha256') !~ '^[0-9a-f]{64}$'
  ) THEN
    RAISE EXCEPTION 'invalid artifact manifest entry' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_source_manifest) AS source_entry(value)
    WHERE source_entry.value ->> 'path' NOT IN (
      'data/fixture.json',
      'index.html',
      'src/main.js',
      'src/styles.css'
    )
  ) OR (
    SELECT count(*) <> count(DISTINCT source_entry.value ->> 'path')
    FROM jsonb_array_elements(p_source_manifest) AS source_entry(value)
  ) THEN
    RAISE EXCEPTION 'source manifest does not match the authoring allowlist'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_bundle_manifest) AS bundle_entry(value)
    WHERE bundle_entry.value ->> 'path' = 'index.html'
  ) OR (
    SELECT count(*) <> count(DISTINCT bundle_entry.value ->> 'path')
    FROM jsonb_array_elements(p_bundle_manifest) AS bundle_entry(value)
  ) THEN
    RAISE EXCEPTION 'bundle manifest is missing a unique entrypoint'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    existing_artifact.id AS artifact_id,
    existing_revision.id AS revision_id,
    existing_artifact.title,
    existing_revision.created_at
  INTO v_existing
  FROM public.report_artifact_revisions AS existing_revision
  JOIN public.report_artifacts AS existing_artifact
    ON existing_artifact.id = existing_revision.artifact_id
   AND existing_artifact.accepted_revision_id = existing_revision.id
  WHERE existing_revision.request_id = p_request_id
    AND existing_revision.status = 'accepted';

  IF FOUND THEN
    RETURN QUERY SELECT
      v_existing.artifact_id,
      v_existing.revision_id,
      v_existing.title,
      v_existing.created_at;
    RETURN;
  END IF;

  SELECT operation.id
  INTO v_operation_id
  FROM public.operations AS operation
  WHERE operation.reference_code = p_source_reference;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'operation reference does not exist'
      USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.report_artifacts (
    id,
    operation_id,
    kind,
    title
  ) VALUES (
    p_artifact_id,
    v_operation_id,
    'custom_report',
    p_title
  );

  INSERT INTO public.report_artifact_revisions (
    id,
    artifact_id,
    status,
    request_id,
    storage_bucket,
    storage_prefix,
    source_manifest,
    bundle_manifest,
    screenshot_path,
    template_alias,
    accepted_at
  ) VALUES (
    p_revision_id,
    p_artifact_id,
    'accepted',
    p_request_id,
    p_storage_bucket,
    p_storage_prefix,
    p_source_manifest,
    p_bundle_manifest,
    p_screenshot_path,
    p_template_alias,
    clock_timestamp()
  );

  UPDATE public.report_artifacts AS accepted_artifact
  SET
    accepted_revision_id = p_revision_id,
    updated_at = clock_timestamp()
  WHERE accepted_artifact.id = p_artifact_id
    AND accepted_artifact.accepted_revision_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'artifact already has a different accepted head'
      USING ERRCODE = '23505';
  END IF;

  RETURN QUERY
  SELECT
    accepted_artifact.id,
    accepted_revision.id,
    accepted_artifact.title,
    accepted_revision.created_at
  FROM public.report_artifacts AS accepted_artifact
  JOIN public.report_artifact_revisions AS accepted_revision
    ON accepted_revision.id = accepted_artifact.accepted_revision_id
  WHERE accepted_artifact.id = p_artifact_id;

EXCEPTION
  WHEN unique_violation THEN
    SELECT
      existing_artifact.id AS artifact_id,
      existing_revision.id AS revision_id,
      existing_artifact.title,
      existing_revision.created_at
    INTO v_existing
    FROM public.report_artifact_revisions AS existing_revision
    JOIN public.report_artifacts AS existing_artifact
      ON existing_artifact.id = existing_revision.artifact_id
     AND existing_artifact.accepted_revision_id = existing_revision.id
    WHERE existing_revision.request_id = p_request_id
      AND existing_revision.status = 'accepted';

    IF FOUND THEN
      RETURN QUERY SELECT
        v_existing.artifact_id,
        v_existing.revision_id,
        v_existing.title,
        v_existing.created_at;
      RETURN;
    END IF;
    RAISE;
END;
$$;

REVOKE ALL PRIVILEGES
  ON FUNCTION public.accept_report_artifact_revision(
    UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT
  )
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION public.accept_report_artifact_revision(
    UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT
  )
  TO service_role;

CREATE OR REPLACE FUNCTION public.find_accepted_report_artifact_by_request_id(
  p_request_id TEXT
)
RETURNS TABLE (
  artifact_id UUID,
  revision_id UUID,
  title TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    accepted_artifact.id,
    accepted_revision.id,
    accepted_artifact.title,
    accepted_revision.created_at
  FROM public.report_artifact_revisions AS accepted_revision
  JOIN public.report_artifacts AS accepted_artifact
    ON accepted_artifact.id = accepted_revision.artifact_id
   AND accepted_artifact.accepted_revision_id = accepted_revision.id
  WHERE accepted_revision.request_id = p_request_id
    AND accepted_revision.status = 'accepted'
  LIMIT 1
$$;

REVOKE ALL PRIVILEGES
  ON FUNCTION public.find_accepted_report_artifact_by_request_id(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION public.find_accepted_report_artifact_by_request_id(TEXT)
  TO service_role;

COMMENT ON TABLE public.report_artifacts IS
  'Authority record for immutable accepted custom-report revisions.';
COMMENT ON TABLE public.report_artifact_revisions IS
  'Immutable manifests and private Storage references for one report revision.';
COMMENT ON FUNCTION public.accept_report_artifact_revision(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT
) IS
  'Atomically accepts one fully uploaded report revision; request IDs are idempotent.';
COMMENT ON FUNCTION public.find_accepted_report_artifact_by_request_id(TEXT) IS
  'Returns an accepted current-head descriptor before any paid authoring starts.';
