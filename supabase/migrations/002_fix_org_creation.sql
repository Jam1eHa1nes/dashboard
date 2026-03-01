-- =============================================================================
-- QACore — Fix org creation + allow duplicate org names
-- 002_fix_org_creation.sql
-- Idempotent: safe to run multiple times
-- =============================================================================
--
-- Changes:
-- 1. Drop the on_org_created trigger — its double-insert into org_members (once
--    from the trigger, once from create_org) causes a duplicate key error that
--    rolls back the whole transaction.
-- 2. Drop the UNIQUE constraint on organisations.slug — org names (and their
--    derived slugs) must be globally unique, but that's wrong. Multiple users
--    should be able to create their own "Acme Corp". The real identifier is the
--    UUID primary key; routing now uses the org ID, not the slug.
-- 3. Create (or replace) the create_org() RPC which atomically inserts the org
--    and adds the creator as owner. Returns the new org UUID (as text) so the
--    frontend can navigate directly to /org/<uuid>.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop the old trigger and its function
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_org_created ON organisations;
DROP FUNCTION IF EXISTS handle_new_org();

-- ---------------------------------------------------------------------------
-- 2. Remove UNIQUE constraint on slug so duplicate org names are allowed
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'organisations' AND indexname = 'organisations_slug_key'
  ) THEN
    ALTER TABLE organisations DROP CONSTRAINT organisations_slug_key;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Create (or replace) create_org RPC
--    SECURITY DEFINER guarantees auth.uid() == the calling user's UUID.
--    Returns the new org UUID so the client can navigate to /org/<uuid>.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_org(p_name text, p_slug text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  INSERT INTO organisations (name, slug)
  VALUES (p_name, p_slug)
  RETURNING id INTO v_org_id;

  INSERT INTO org_members (org_id, user_id, role)
  VALUES (v_org_id, auth.uid(), 'owner');

  RETURN v_org_id::text;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_org(text, text) TO authenticated;

-- Notify PostgREST to refresh its schema cache immediately
NOTIFY pgrst, 'reload schema';
