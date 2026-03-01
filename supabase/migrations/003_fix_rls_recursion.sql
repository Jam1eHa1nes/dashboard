-- =============================================================================
-- QACore — Fix RLS infinite recursion + org creation
-- 003_fix_rls_recursion.sql
--
-- Run this in Supabase → SQL Editor. Safe to run multiple times.
--
-- Root cause: members_select queries org_members to check membership, which
-- triggers members_select again → infinite loop. Every other table's policies
-- do the same (they all query org_members), so they all hit the same loop.
--
-- Fix: two SECURITY DEFINER helper functions that read org_members without
-- triggering RLS. All policies are rewritten to call these helpers instead
-- of inlining the subquery.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop the old trigger (double-inserts into org_members → duplicate key)
-- ---------------------------------------------------------------------------
DROP TRIGGER  IF EXISTS on_org_created ON organisations;
DROP FUNCTION IF EXISTS handle_new_org();

-- ---------------------------------------------------------------------------
-- 2. Remove UNIQUE constraint on slug (any user should be able to call their
--    org "Acme Corp" — the UUID primary key is the real identifier)
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
-- 3. Helper functions — SECURITY DEFINER bypasses RLS so they can read
--    org_members freely without triggering any policy recursion
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_org_admin_or_owner(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION is_org_member(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_admin_or_owner(uuid)  TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. org_members policies (DROP first so we can recreate cleanly)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS members_select ON org_members;
DROP POLICY IF EXISTS members_insert ON org_members;
DROP POLICY IF EXISTS members_update ON org_members;
DROP POLICY IF EXISTS members_delete ON org_members;

-- Members can see everyone in their org
CREATE POLICY members_select ON org_members
  FOR SELECT USING (is_org_member(org_id));

-- Owners/admins can add members; users can insert their own row (self-join via invite)
CREATE POLICY members_insert ON org_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR is_org_admin_or_owner(org_id)
  );

CREATE POLICY members_update ON org_members
  FOR UPDATE USING (is_org_admin_or_owner(org_id));

-- Owners/admins can remove anyone; members can remove themselves
CREATE POLICY members_delete ON org_members
  FOR DELETE USING (
    auth.uid() = user_id OR is_org_admin_or_owner(org_id)
  );

-- ---------------------------------------------------------------------------
-- 5. organisations policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS orgs_select ON organisations;
DROP POLICY IF EXISTS orgs_insert ON organisations;
DROP POLICY IF EXISTS orgs_update ON organisations;

CREATE POLICY orgs_select ON organisations
  FOR SELECT USING (is_org_member(id));

-- Any authenticated user can create an org (create_org RPC adds them as owner)
CREATE POLICY orgs_insert ON organisations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY orgs_update ON organisations
  FOR UPDATE USING (is_org_admin_or_owner(id));

-- ---------------------------------------------------------------------------
-- 6. projects policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS projects_select ON projects;
DROP POLICY IF EXISTS projects_insert ON projects;
DROP POLICY IF EXISTS projects_update ON projects;
DROP POLICY IF EXISTS projects_delete ON projects;

CREATE POLICY projects_select ON projects
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY projects_insert ON projects
  FOR INSERT WITH CHECK (is_org_admin_or_owner(org_id));

CREATE POLICY projects_update ON projects
  FOR UPDATE USING (is_org_admin_or_owner(org_id));

CREATE POLICY projects_delete ON projects
  FOR DELETE USING (is_org_admin_or_owner(org_id));

-- ---------------------------------------------------------------------------
-- 7. api_keys policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS api_keys_select ON api_keys;
DROP POLICY IF EXISTS api_keys_insert ON api_keys;
DROP POLICY IF EXISTS api_keys_delete ON api_keys;

CREATE POLICY api_keys_select ON api_keys
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY api_keys_insert ON api_keys
  FOR INSERT WITH CHECK (is_org_admin_or_owner(org_id));

CREATE POLICY api_keys_delete ON api_keys
  FOR DELETE USING (is_org_admin_or_owner(org_id));

-- ---------------------------------------------------------------------------
-- 8. runs policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS runs_select ON runs;
DROP POLICY IF EXISTS runs_insert ON runs;

CREATE POLICY runs_select ON runs
  FOR SELECT USING (is_org_member(org_id));

-- Ingest via API key uses service role, so this covers manual/dashboard inserts
CREATE POLICY runs_insert ON runs
  FOR INSERT WITH CHECK (is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- 9. suites policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS suites_select ON suites;
DROP POLICY IF EXISTS suites_insert ON suites;

CREATE POLICY suites_select ON suites
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY suites_insert ON suites
  FOR INSERT WITH CHECK (is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- 10. test_results policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS test_results_select ON test_results;
DROP POLICY IF EXISTS test_results_insert ON test_results;

CREATE POLICY test_results_select ON test_results
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY test_results_insert ON test_results
  FOR INSERT WITH CHECK (is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- 11. audit_log policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_log_select ON audit_log;
DROP POLICY IF EXISTS audit_log_insert ON audit_log;

CREATE POLICY audit_log_select ON audit_log
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY audit_log_insert ON audit_log
  FOR INSERT WITH CHECK (is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- 12. invitations policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS invitations_select ON invitations;
DROP POLICY IF EXISTS invitations_insert ON invitations;
DROP POLICY IF EXISTS invitations_update ON invitations;

CREATE POLICY invitations_select ON invitations
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY invitations_insert ON invitations
  FOR INSERT WITH CHECK (is_org_admin_or_owner(org_id));

-- Accept flow sets accepted_at — no membership check needed
CREATE POLICY invitations_update ON invitations
  FOR UPDATE USING (true);

-- ---------------------------------------------------------------------------
-- 13. create_org RPC — atomically creates the org and adds the caller as owner
--     Returns the new org UUID so the frontend can navigate to /org/<uuid>
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

GRANT EXECUTE ON FUNCTION create_org(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Refresh PostgREST schema cache
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
