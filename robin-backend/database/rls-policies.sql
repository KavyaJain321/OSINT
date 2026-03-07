-- ============================================================
-- ROBIN OSINT — Row Level Security Policies
-- Run AFTER schema.sql in Supabase SQL Editor
-- ============================================================
-- SUPER_ADMIN can see/modify everything.
-- All others only see rows matching their client_id from JWT.
-- ============================================================

-- Helper: extract client_id from JWT
-- Usage: get_my_client_id()
CREATE OR REPLACE FUNCTION get_my_client_id() RETURNS UUID AS $$
  SELECT ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'client_id')::uuid;
$$ LANGUAGE sql STABLE;

-- Helper: extract role from JWT
CREATE OR REPLACE FUNCTION get_my_role() RETURNS TEXT AS $$
  SELECT (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role';
$$ LANGUAGE sql STABLE;

-- Helper: check if current user is SUPER_ADMIN
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
  SELECT get_my_role() = 'SUPER_ADMIN';
$$ LANGUAGE sql STABLE;

-- ============================================================
-- Enable RLS on all data tables
-- ============================================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE narrative_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_state ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- clients — SUPER_ADMIN sees all, others see own
-- ============================================================
CREATE POLICY clients_select ON clients FOR SELECT USING (is_super_admin() OR id = get_my_client_id());
CREATE POLICY clients_insert ON clients FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY clients_update ON clients FOR UPDATE USING (is_super_admin());
CREATE POLICY clients_delete ON clients FOR DELETE USING (is_super_admin());

-- ============================================================
-- users — self-access + admin scope + super admin all
-- ============================================================
CREATE POLICY users_select ON users FOR SELECT USING (
  is_super_admin()
  OR id = auth.uid()
  OR (get_my_role() = 'ADMIN' AND client_id = get_my_client_id())
);
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (is_super_admin() OR get_my_role() = 'ADMIN');
CREATE POLICY users_update ON users FOR UPDATE USING (
  is_super_admin() OR id = auth.uid()
  OR (get_my_role() = 'ADMIN' AND client_id = get_my_client_id())
);
CREATE POLICY users_delete ON users FOR DELETE USING (
  is_super_admin() OR (get_my_role() = 'ADMIN' AND client_id = get_my_client_id())
);

-- ============================================================
-- sources — tenant-isolated
-- ============================================================
CREATE POLICY sources_select ON sources FOR SELECT USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY sources_insert ON sources FOR INSERT WITH CHECK (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY sources_update ON sources FOR UPDATE USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY sources_delete ON sources FOR DELETE USING (is_super_admin() OR client_id = get_my_client_id());

-- ============================================================
-- watch_keywords — tenant-isolated
-- ============================================================
CREATE POLICY keywords_select ON watch_keywords FOR SELECT USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY keywords_insert ON watch_keywords FOR INSERT WITH CHECK (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY keywords_update ON watch_keywords FOR UPDATE USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY keywords_delete ON watch_keywords FOR DELETE USING (is_super_admin() OR client_id = get_my_client_id());

-- ============================================================
-- articles — tenant-isolated
-- ============================================================
CREATE POLICY articles_select ON articles FOR SELECT USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY articles_insert ON articles FOR INSERT WITH CHECK (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY articles_update ON articles FOR UPDATE USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY articles_delete ON articles FOR DELETE USING (is_super_admin() OR client_id = get_my_client_id());

-- ============================================================
-- article_analysis — access follows parent article
-- ============================================================
CREATE POLICY analysis_select ON article_analysis FOR SELECT USING (
  is_super_admin() OR EXISTS (
    SELECT 1 FROM articles WHERE articles.id = article_analysis.article_id AND articles.client_id = get_my_client_id()
  )
);
CREATE POLICY analysis_insert ON article_analysis FOR INSERT WITH CHECK (
  is_super_admin() OR EXISTS (
    SELECT 1 FROM articles WHERE articles.id = article_analysis.article_id AND articles.client_id = get_my_client_id()
  )
);
CREATE POLICY analysis_update ON article_analysis FOR UPDATE USING (
  is_super_admin() OR EXISTS (
    SELECT 1 FROM articles WHERE articles.id = article_analysis.article_id AND articles.client_id = get_my_client_id()
  )
);
CREATE POLICY analysis_delete ON article_analysis FOR DELETE USING (
  is_super_admin() OR EXISTS (
    SELECT 1 FROM articles WHERE articles.id = article_analysis.article_id AND articles.client_id = get_my_client_id()
  )
);

-- ============================================================
-- entity_mentions — tenant-isolated
-- ============================================================
CREATE POLICY entities_select ON entity_mentions FOR SELECT USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY entities_insert ON entity_mentions FOR INSERT WITH CHECK (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY entities_update ON entity_mentions FOR UPDATE USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY entities_delete ON entity_mentions FOR DELETE USING (is_super_admin() OR client_id = get_my_client_id());

-- ============================================================
-- narrative_patterns — tenant-isolated
-- ============================================================
CREATE POLICY patterns_select ON narrative_patterns FOR SELECT USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY patterns_insert ON narrative_patterns FOR INSERT WITH CHECK (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY patterns_update ON narrative_patterns FOR UPDATE USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY patterns_delete ON narrative_patterns FOR DELETE USING (is_super_admin() OR client_id = get_my_client_id());

-- ============================================================
-- article_files — tenant-isolated
-- ============================================================
CREATE POLICY files_select ON article_files FOR SELECT USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY files_insert ON article_files FOR INSERT WITH CHECK (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY files_update ON article_files FOR UPDATE USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY files_delete ON article_files FOR DELETE USING (is_super_admin() OR client_id = get_my_client_id());

-- ============================================================
-- reports — tenant-isolated
-- ============================================================
CREATE POLICY reports_select ON reports FOR SELECT USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY reports_insert ON reports FOR INSERT WITH CHECK (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY reports_update ON reports FOR UPDATE USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY reports_delete ON reports FOR DELETE USING (is_super_admin() OR client_id = get_my_client_id());

-- ============================================================
-- chat_history — users see only their own chats
-- ============================================================
CREATE POLICY chat_select ON chat_history FOR SELECT USING (
  is_super_admin() OR user_id = auth.uid()
);
CREATE POLICY chat_insert ON chat_history FOR INSERT WITH CHECK (
  user_id = auth.uid()
);
CREATE POLICY chat_update ON chat_history FOR UPDATE USING (
  is_super_admin() OR user_id = auth.uid()
);
CREATE POLICY chat_delete ON chat_history FOR DELETE USING (
  is_super_admin() OR user_id = auth.uid()
);

-- ============================================================
-- system_state — backend only, deny all authenticated access
-- ============================================================
CREATE POLICY system_state_deny_all ON system_state FOR ALL USING (false);
