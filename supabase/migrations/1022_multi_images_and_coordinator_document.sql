-- ============================================================
-- Migration 1022: Multiple reference images per item
--                 + coordinator document attachment
-- ============================================================
--
--   STEP 1.  request_items.image_urls JSONB
--            A request item can now carry SEVERAL reference photos
--            instead of one. Stored as a JSONB array of public URLs.
--            `image_url` is KEPT and continues to hold the FIRST
--            image, so every existing reader (request detail,
--            exports, the cleanup edge function) keeps working with
--            no change. New writers populate both.
--
--   STEP 2.  requests.coordinator_document_url / _name
--            Optional PDF / Word / Excel / CSV a requester attaches
--            alongside their "Message to Coordinator".
--
--   STEP 3.  Storage bucket `request-documents` (public read,
--            authenticated write) + RLS on storage.objects.
--
--   STEP 4.  create_split_requests() refreshed so mixed-category
--            submissions carry the new columns through the RPC.
--            The RPC enumerates columns explicitly, so it MUST be
--            updated in lockstep or split requests would silently
--            drop the extra images and the document.
--
-- WHY JSONB AND NOT TEXT[]
--   The split RPC receives items as JSONB; `v_item->'image_urls'`
--   is already a JSONB array and assigns straight across, with no
--   array-conversion gymnastics. supabase-js also serialises a JS
--   string[] into JSONB cleanly on insert.
--
-- IDEMPOTENCE
--   All statements use IF NOT EXISTS / CREATE OR REPLACE /
--   DROP ... IF EXISTS, so this migration is safe to re-apply.
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1 — request_items.image_urls
-- ============================================================

ALTER TABLE public.request_items
    ADD COLUMN IF NOT EXISTS image_urls JSONB;

COMMENT ON COLUMN public.request_items.image_urls IS
'Ordered JSONB array of reference-image public URLs (sample-images bucket). '
'Added in migration 1022 for multi-image support. image_urls[0] is mirrored '
'into image_url for backward compatibility — treat image_url as the primary '
'image and image_urls as the full set. NULL means no reference images.';

COMMENT ON COLUMN public.request_items.image_url IS
'Primary (first) reference image. Kept alongside image_urls so pre-1022 '
'readers continue to work unchanged.';

-- Backfill: existing single-image rows become one-element arrays so
-- readers can rely on image_urls whenever any image exists.
UPDATE public.request_items
   SET image_urls = jsonb_build_array(image_url)
 WHERE image_url IS NOT NULL
   AND image_url <> ''
   AND image_urls IS NULL;

-- ============================================================
-- STEP 2 — requests.coordinator_document_url / _name
-- ============================================================

ALTER TABLE public.requests
    ADD COLUMN IF NOT EXISTS coordinator_document_url  TEXT,
    ADD COLUMN IF NOT EXISTS coordinator_document_name TEXT;

COMMENT ON COLUMN public.requests.coordinator_document_url IS
'Public URL of an optional document (PDF/Word/Excel/CSV) the requester '
'attaches with their message to the coordinator. Lives in the '
'request-documents bucket. NULL when no document was attached.';

COMMENT ON COLUMN public.requests.coordinator_document_name IS
'Original filename of coordinator_document_url, preserved for display '
'because the storage path is UUID-prefixed for uniqueness.';

-- ============================================================
-- STEP 3 — Storage bucket: request-documents
-- ============================================================
-- Public read (same posture as dispatch-images: the URL is an
-- unguessable UUID path and the app links to it directly).
-- Writes are limited to authenticated, active users.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'request-documents',
  'request-documents',
  TRUE,
  10485760,                                      -- 10 MB per object
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/octet-stream'                   -- mobile pickers often report this
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "request_documents_insert_authenticated" ON storage.objects;
CREATE POLICY "request_documents_insert_authenticated"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'request-documents'
    AND EXISTS (
      SELECT 1
        FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "request_documents_select_authenticated" ON storage.objects;
CREATE POLICY "request_documents_select_authenticated"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'request-documents');

-- ============================================================
-- STEP 4 — create_split_requests: carry the new columns
-- ============================================================
-- Same body as migration 1004, with two additions:
--   * requests INSERT gains coordinator_document_url / _name
--   * request_items INSERT gains image_urls
-- Everything else is byte-for-byte the 1004 definition.

CREATE OR REPLACE FUNCTION public.create_split_requests(
  p_request_data JSONB,
  p_marble_items JSONB,
  p_magro_items  JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marble_id     UUID;
  v_magro_id      UUID;
  v_marble_number TEXT;
  v_magro_number  TEXT;
  v_item          JSONB;
  v_idx           INTEGER;
  v_marble_count  INTEGER;
  v_magro_count   INTEGER;
  v_created_by    UUID;
  v_status        request_status;
  v_priority      priority;
BEGIN
  -- Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_created_by := (p_request_data->>'created_by')::UUID;

  -- Verify caller matches created_by
  IF v_created_by != auth.uid() THEN
    RAISE EXCEPTION 'Permission denied: created_by must match authenticated user';
  END IF;

  v_status       := COALESCE(p_request_data->>'status', 'pending_approval')::request_status;
  v_priority     := COALESCE(p_request_data->>'priority', 'normal')::priority;
  v_marble_count := jsonb_array_length(p_marble_items);
  v_magro_count  := jsonb_array_length(p_magro_items);

  -- ── INSERT MARBLE REQUEST ─────────────────────────────────
  INSERT INTO public.requests (
    created_by, status, category, priority,
    department, mobile_no, pickup_responsibility,
    delivery_address, delivery_poc_name, delivery_poc_contacts,
    required_by,
    client_type, client_contact_name, client_phone, client_email,
    firm_name, site_location,
    supporting_architect_name, architect_firm_name,
    project_type, project_placeholder,
    purpose, packing_details,
    requester_message,
    coordinator_document_url, coordinator_document_name,
    item_count
  ) VALUES (
    v_created_by,
    v_status,
    'marble',
    v_priority,
    p_request_data->>'department',
    p_request_data->>'mobile_no',
    p_request_data->>'pickup_responsibility',
    p_request_data->>'delivery_address',
    NULLIF(p_request_data->>'delivery_poc_name', ''),
    CASE
      WHEN p_request_data->'delivery_poc_contacts' IS NOT NULL
           AND jsonb_typeof(p_request_data->'delivery_poc_contacts') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_request_data->'delivery_poc_contacts'))
      ELSE NULL
    END,
    NULLIF(p_request_data->>'required_by', '')::TIMESTAMPTZ,
    p_request_data->>'client_type',
    p_request_data->>'client_contact_name',
    p_request_data->>'client_phone',
    NULLIF(p_request_data->>'client_email', ''),
    p_request_data->>'firm_name',
    p_request_data->>'site_location',
    NULLIF(p_request_data->>'supporting_architect_name', ''),
    NULLIF(p_request_data->>'architect_firm_name', ''),
    NULLIF(p_request_data->>'project_type', ''),
    NULLIF(p_request_data->>'project_placeholder', ''),
    p_request_data->>'purpose',
    p_request_data->>'packing_details',
    NULLIF(p_request_data->>'requester_message', ''),
    NULLIF(p_request_data->>'coordinator_document_url', ''),
    NULLIF(p_request_data->>'coordinator_document_name', ''),
    v_marble_count
  )
  RETURNING id, request_number INTO v_marble_id, v_marble_number;

  -- Insert marble items (supports both regular items and kit placeholders)
  v_idx := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_marble_items)
  LOOP
    INSERT INTO public.request_items (
      request_id, item_index, product_type, sub_category,
      quality, sample_size, thickness, finish, quantity,
      image_url, image_urls,
      is_kit, is_unpacked
    ) VALUES (
      v_marble_id,
      v_idx,
      'marble',
      NULL,
      NULLIF(v_item->>'quality', ''),
      v_item->>'sample_size',
      NULLIF(v_item->>'thickness', ''),
      NULLIF(v_item->>'finish', ''),
      (v_item->>'quantity')::INTEGER,
      NULLIF(v_item->>'image_url', ''),
      CASE
        WHEN jsonb_typeof(v_item->'image_urls') = 'array'
             AND jsonb_array_length(v_item->'image_urls') > 0
        THEN v_item->'image_urls'
        ELSE NULL
      END,
      COALESCE((v_item->>'is_kit')::BOOLEAN, FALSE),
      FALSE
    );
    v_idx := v_idx + 1;
  END LOOP;

  -- ── INSERT MAGRO REQUEST ──────────────────────────────────
  INSERT INTO public.requests (
    created_by, status, category, priority,
    department, mobile_no, pickup_responsibility,
    delivery_address, delivery_poc_name, delivery_poc_contacts,
    required_by,
    client_type, client_contact_name, client_phone, client_email,
    firm_name, site_location,
    supporting_architect_name, architect_firm_name,
    project_type, project_placeholder,
    purpose, packing_details,
    requester_message,
    coordinator_document_url, coordinator_document_name,
    item_count
  ) VALUES (
    v_created_by,
    v_status,
    'magro',
    v_priority,
    p_request_data->>'department',
    p_request_data->>'mobile_no',
    p_request_data->>'pickup_responsibility',
    p_request_data->>'delivery_address',
    NULLIF(p_request_data->>'delivery_poc_name', ''),
    CASE
      WHEN p_request_data->'delivery_poc_contacts' IS NOT NULL
           AND jsonb_typeof(p_request_data->'delivery_poc_contacts') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_request_data->'delivery_poc_contacts'))
      ELSE NULL
    END,
    NULLIF(p_request_data->>'required_by', '')::TIMESTAMPTZ,
    p_request_data->>'client_type',
    p_request_data->>'client_contact_name',
    p_request_data->>'client_phone',
    NULLIF(p_request_data->>'client_email', ''),
    p_request_data->>'firm_name',
    p_request_data->>'site_location',
    NULLIF(p_request_data->>'supporting_architect_name', ''),
    NULLIF(p_request_data->>'architect_firm_name', ''),
    NULLIF(p_request_data->>'project_type', ''),
    NULLIF(p_request_data->>'project_placeholder', ''),
    p_request_data->>'purpose',
    p_request_data->>'packing_details',
    NULLIF(p_request_data->>'requester_message', ''),
    NULLIF(p_request_data->>'coordinator_document_url', ''),
    NULLIF(p_request_data->>'coordinator_document_name', ''),
    v_magro_count
  )
  RETURNING id, request_number INTO v_magro_id, v_magro_number;

  -- Insert magro items (supports both regular items and kit placeholders)
  v_idx := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_magro_items)
  LOOP
    INSERT INTO public.request_items (
      request_id, item_index, product_type, sub_category,
      quality, sample_size, thickness, finish, quantity,
      image_url, image_urls,
      is_kit, is_unpacked
    ) VALUES (
      v_magro_id,
      v_idx,
      'magro',
      NULLIF(v_item->>'sub_category', ''),
      NULLIF(v_item->>'quality', ''),
      v_item->>'sample_size',
      NULLIF(v_item->>'thickness', ''),
      NULLIF(v_item->>'finish', ''),
      (v_item->>'quantity')::INTEGER,
      NULLIF(v_item->>'image_url', ''),
      CASE
        WHEN jsonb_typeof(v_item->'image_urls') = 'array'
             AND jsonb_array_length(v_item->'image_urls') > 0
        THEN v_item->'image_urls'
        ELSE NULL
      END,
      COALESCE((v_item->>'is_kit')::BOOLEAN, FALSE),
      FALSE
    );
    v_idx := v_idx + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'marble_id',     v_marble_id,
    'marble_number', v_marble_number,
    'magro_id',      v_magro_id,
    'magro_number',  v_magro_number
  );
END;
$$;

-- Re-grant execute (idempotent)
GRANT EXECUTE ON FUNCTION public.create_split_requests(JSONB, JSONB, JSONB) TO authenticated;

-- ============================================================
-- STEP 5 — Sanity verification
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'request_items'
       AND column_name  = 'image_urls'
  ) THEN
    RAISE EXCEPTION 'Migration 1022 FAILED — request_items.image_urls missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'requests'
       AND column_name  = 'coordinator_document_url'
  ) THEN
    RAISE EXCEPTION 'Migration 1022 FAILED — requests.coordinator_document_url missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'request-documents'
  ) THEN
    RAISE EXCEPTION 'Migration 1022 FAILED — request-documents bucket missing.';
  END IF;

  RAISE NOTICE
    'Migration 1022 OK — image_urls, coordinator_document_url/_name, request-documents bucket, split RPC updated.';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (manual, not part of migration)
-- ============================================================
-- Re-apply migration 1004 to restore the previous RPC definition, then:
--
-- DROP POLICY IF EXISTS "request_documents_insert_authenticated" ON storage.objects;
-- DROP POLICY IF EXISTS "request_documents_select_authenticated" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'request-documents';
-- ALTER TABLE public.requests      DROP COLUMN IF EXISTS coordinator_document_url;
-- ALTER TABLE public.requests      DROP COLUMN IF EXISTS coordinator_document_name;
-- ALTER TABLE public.request_items DROP COLUMN IF EXISTS image_urls;
-- ============================================================
