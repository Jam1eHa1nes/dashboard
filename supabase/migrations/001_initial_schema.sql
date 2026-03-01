-- =============================================================================
-- QACore — Initial Schema Migration
-- 001_initial_schema.sql
-- Idempotent: safe to run multiple times
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

-- organisations
CREATE TABLE IF NOT EXISTS organisations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- org_members
CREATE TABLE IF NOT EXISTS org_members (
  org_id      uuid REFERENCES organisations(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id)    ON DELETE CASCADE,
  role        text CHECK (role IN ('owner','admin','member','viewer')),
  invited_by  uuid REFERENCES auth.users(id),
  joined_at   timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

-- projects
CREATE TABLE IF NOT EXISTS projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name        text NOT NULL,
  slug        text NOT NULL,
  description text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (org_id, slug)
);

-- api_keys
CREATE TABLE IF NOT EXISTS api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid REFERENCES projects(id)       ON DELETE CASCADE,
  org_id       uuid REFERENCES organisations(id),
  key_hash     text UNIQUE NOT NULL, -- SHA-256 of the raw key, never store plaintext
  key_prefix   text NOT NULL,        -- first 8 chars shown in UI e.g. "qac_a3f9"
  label        text,
  last_used_at timestamptz,
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now()
);

-- runs
CREATE TABLE IF NOT EXISTS runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid REFERENCES projects(id)       ON DELETE CASCADE,
  org_id         uuid REFERENCES organisations(id),
  framework      text,
  branch         text,
  commit_sha     text,
  commit_message text,
  total          int  DEFAULT 0,
  passed         int  DEFAULT 0,
  failed         int  DEFAULT 0,
  skipped        int  DEFAULT 0,
  duration_ms    int,
  triggered_by   text CHECK (triggered_by IN ('ci','manual','api')),
  metadata       jsonb DEFAULT '{}',
  created_at     timestamptz DEFAULT now()
);

-- suites
CREATE TABLE IF NOT EXISTS suites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      uuid REFERENCES runs(id)          ON DELETE CASCADE,
  org_id      uuid REFERENCES organisations(id),
  name        text NOT NULL,
  total       int  DEFAULT 0,
  passed      int  DEFAULT 0,
  failed      int  DEFAULT 0,
  skipped     int  DEFAULT 0,
  duration_ms int
);

-- test_results
CREATE TABLE IF NOT EXISTS test_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id      uuid REFERENCES suites(id) ON DELETE CASCADE,
  run_id        uuid REFERENCES runs(id)   ON DELETE CASCADE,
  org_id        uuid REFERENCES organisations(id),
  name          text NOT NULL,
  full_name     text,
  state         text CHECK (state IN ('passed','failed','skipped','pending')),
  duration_ms   int,
  error_message text,
  error_stack   text,
  retry_count   int DEFAULT 0
);

-- audit_log
CREATE TABLE IF NOT EXISTS audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid REFERENCES organisations(id),
  user_id    uuid REFERENCES auth.users(id),
  action     text NOT NULL,
  metadata   jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- invitations
CREATE TABLE IF NOT EXISTS invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES organisations(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text CHECK (role IN ('admin','member','viewer')),
  token       text UNIQUE NOT NULL,
  invited_by  uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  expires_at  timestamptz DEFAULT (now() + INTERVAL '7 days'),
  created_at  timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_org_members_user_id   ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id        ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_project_id    ON api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id        ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_runs_project_id        ON runs(project_id);
CREATE INDEX IF NOT EXISTS idx_runs_org_id            ON runs(org_id);
CREATE INDEX IF NOT EXISTS idx_runs_created_at        ON runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suites_run_id          ON suites(run_id);
CREATE INDEX IF NOT EXISTS idx_test_results_run_id    ON test_results(run_id);
CREATE INDEX IF NOT EXISTS idx_test_results_suite_id  ON test_results(suite_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id       ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at   ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitations_token      ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_org_id     ON invitations(org_id);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys      ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE suites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations   ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- HELPER: membership check (used repeatedly below)
-- ---------------------------------------------------------------------------
-- We use inline subqueries to avoid circular dependency on functions.

-- ---------------------------------------------------------------------------
-- organisations policies
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organisations' AND policyname = 'orgs_select'
  ) THEN
    CREATE POLICY orgs_select ON organisations
      FOR SELECT USING (
        auth.uid() IN (
          SELECT user_id FROM org_members WHERE org_id = id
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organisations' AND policyname = 'orgs_insert'
  ) THEN
    -- Any authenticated user can create an org (they become owner via trigger)
    CREATE POLICY orgs_insert ON organisations
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organisations' AND policyname = 'orgs_update'
  ) THEN
    CREATE POLICY orgs_update ON organisations
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = id
            AND user_id = auth.uid()
            AND role IN ('owner','admin')
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- org_members policies
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'org_members' AND policyname = 'members_select'
  ) THEN
    CREATE POLICY members_select ON org_members
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM org_members om
          WHERE om.org_id = org_members.org_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'org_members' AND policyname = 'members_insert'
  ) THEN
    CREATE POLICY members_insert ON org_members
      FOR INSERT WITH CHECK (
        -- owner/admin can add members, or self-join via invitation
        auth.uid() = user_id OR
        EXISTS (
          SELECT 1 FROM org_members om
          WHERE om.org_id = org_members.org_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner','admin')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'org_members' AND policyname = 'members_update'
  ) THEN
    CREATE POLICY members_update ON org_members
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM org_members om
          WHERE om.org_id = org_members.org_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner','admin')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'org_members' AND policyname = 'members_delete'
  ) THEN
    CREATE POLICY members_delete ON org_members
      FOR DELETE USING (
        -- owners/admins can remove anyone; members can remove themselves
        auth.uid() = user_id OR
        EXISTS (
          SELECT 1 FROM org_members om
          WHERE om.org_id = org_members.org_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner','admin')
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- projects policies
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects' AND policyname = 'projects_select'
  ) THEN
    CREATE POLICY projects_select ON projects
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = projects.org_id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects' AND policyname = 'projects_insert'
  ) THEN
    CREATE POLICY projects_insert ON projects
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = projects.org_id
            AND user_id = auth.uid()
            AND role IN ('owner','admin')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects' AND policyname = 'projects_update'
  ) THEN
    CREATE POLICY projects_update ON projects
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = projects.org_id
            AND user_id = auth.uid()
            AND role IN ('owner','admin')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects' AND policyname = 'projects_delete'
  ) THEN
    CREATE POLICY projects_delete ON projects
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = projects.org_id
            AND user_id = auth.uid()
            AND role IN ('owner','admin')
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- api_keys policies
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'api_keys' AND policyname = 'api_keys_select'
  ) THEN
    CREATE POLICY api_keys_select ON api_keys
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = api_keys.org_id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'api_keys' AND policyname = 'api_keys_insert'
  ) THEN
    CREATE POLICY api_keys_insert ON api_keys
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = api_keys.org_id
            AND user_id = auth.uid()
            AND role IN ('owner','admin')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'api_keys' AND policyname = 'api_keys_delete'
  ) THEN
    CREATE POLICY api_keys_delete ON api_keys
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = api_keys.org_id
            AND user_id = auth.uid()
            AND role IN ('owner','admin')
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- runs policies (all members can read; write via service role / api key)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'runs' AND policyname = 'runs_select'
  ) THEN
    CREATE POLICY runs_select ON runs
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = runs.org_id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'runs' AND policyname = 'runs_insert'
  ) THEN
    CREATE POLICY runs_insert ON runs
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = runs.org_id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- suites policies
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'suites' AND policyname = 'suites_select'
  ) THEN
    CREATE POLICY suites_select ON suites
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = suites.org_id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'suites' AND policyname = 'suites_insert'
  ) THEN
    CREATE POLICY suites_insert ON suites
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = suites.org_id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- test_results policies
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'test_results' AND policyname = 'test_results_select'
  ) THEN
    CREATE POLICY test_results_select ON test_results
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = test_results.org_id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'test_results' AND policyname = 'test_results_insert'
  ) THEN
    CREATE POLICY test_results_insert ON test_results
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = test_results.org_id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- audit_log policies (insert only — no update/delete for any user)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_log' AND policyname = 'audit_log_select'
  ) THEN
    CREATE POLICY audit_log_select ON audit_log
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = audit_log.org_id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_log' AND policyname = 'audit_log_insert'
  ) THEN
    CREATE POLICY audit_log_insert ON audit_log
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = audit_log.org_id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;
-- Explicitly no UPDATE or DELETE policies on audit_log.

-- ---------------------------------------------------------------------------
-- invitations policies
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'invitations' AND policyname = 'invitations_select'
  ) THEN
    CREATE POLICY invitations_select ON invitations
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = invitations.org_id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'invitations' AND policyname = 'invitations_insert'
  ) THEN
    CREATE POLICY invitations_insert ON invitations
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = invitations.org_id
            AND user_id = auth.uid()
            AND role IN ('owner','admin')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'invitations' AND policyname = 'invitations_update'
  ) THEN
    -- Allow update so accept flow can set accepted_at
    CREATE POLICY invitations_update ON invitations
      FOR UPDATE USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- TRIGGER: auto-add org creator as owner
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_org()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO org_members (org_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner')
  ON CONFLICT (org_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_org_created ON organisations;
CREATE TRIGGER on_org_created
  AFTER INSERT ON organisations
  FOR EACH ROW EXECUTE FUNCTION handle_new_org();

-- ---------------------------------------------------------------------------
-- FUNCTION: get_user_orgs
-- Returns all orgs the user belongs to, with their role.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_orgs(p_user_id uuid)
RETURNS TABLE (
  id         uuid,
  name       text,
  slug       text,
  created_at timestamptz,
  role       text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    o.created_at,
    m.role
  FROM organisations o
  JOIN org_members m ON m.org_id = o.id
  WHERE m.user_id = p_user_id
  ORDER BY o.created_at ASC;
END;
$$;

-- ---------------------------------------------------------------------------
-- FUNCTION: validate_api_key
-- Called by the /api/reports ingest route (SECURITY DEFINER — bypasses RLS).
-- Returns org_id and project_id if the key is valid; updates last_used_at.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_api_key(p_key_hash text)
RETURNS TABLE (
  org_id     uuid,
  project_id uuid
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id         uuid;
  v_org_id     uuid;
  v_project_id uuid;
BEGIN
  SELECT ak.id, ak.org_id, ak.project_id
  INTO   v_id, v_org_id, v_project_id
  FROM   api_keys ak
  WHERE  ak.key_hash = p_key_hash
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN; -- empty result set → caller returns 401
  END IF;

  UPDATE api_keys
  SET    last_used_at = now()
  WHERE  id = v_id;

  RETURN QUERY SELECT v_org_id, v_project_id;
END;
$$;

-- Grant execute to authenticated and service role
GRANT EXECUTE ON FUNCTION get_user_orgs(uuid)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION validate_api_key(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- REALTIME: enable publication for live run updates
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add tables to realtime publication (idempotent via DO block)
DO $$ BEGIN
  -- runs
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE runs;
  END IF;
  -- suites
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'suites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE suites;
  END IF;
END $$;
