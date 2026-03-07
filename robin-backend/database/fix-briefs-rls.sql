-- Fix RLS for client_briefs, brief_generated_keywords, brief_recommended_sources
-- Run this in Supabase SQL Editor

-- Enable RLS on brief tables (if not already)
ALTER TABLE client_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE brief_generated_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE brief_recommended_sources ENABLE ROW LEVEL SECURITY;

-- client_briefs — tenant-isolated
DROP POLICY IF EXISTS briefs_select ON client_briefs;
DROP POLICY IF EXISTS briefs_insert ON client_briefs;
DROP POLICY IF EXISTS briefs_update ON client_briefs;
DROP POLICY IF EXISTS briefs_delete ON client_briefs;

CREATE POLICY briefs_select ON client_briefs FOR SELECT
  USING (is_super_admin() OR client_id = get_my_client_id());

CREATE POLICY briefs_insert ON client_briefs FOR INSERT
  WITH CHECK (is_super_admin() OR client_id = get_my_client_id());

CREATE POLICY briefs_update ON client_briefs FOR UPDATE
  USING (is_super_admin() OR client_id = get_my_client_id());

CREATE POLICY briefs_delete ON client_briefs FOR DELETE
  USING (is_super_admin() OR client_id = get_my_client_id());

-- brief_generated_keywords — access follows parent brief
DROP POLICY IF EXISTS brief_keywords_select ON brief_generated_keywords;
DROP POLICY IF EXISTS brief_keywords_insert ON brief_generated_keywords;
DROP POLICY IF EXISTS brief_keywords_update ON brief_generated_keywords;
DROP POLICY IF EXISTS brief_keywords_delete ON brief_generated_keywords;

CREATE POLICY brief_keywords_select ON brief_generated_keywords FOR SELECT
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM client_briefs cb WHERE cb.id = brief_generated_keywords.brief_id AND cb.client_id = get_my_client_id()
  ));

CREATE POLICY brief_keywords_insert ON brief_generated_keywords FOR INSERT
  WITH CHECK (is_super_admin() OR EXISTS (
    SELECT 1 FROM client_briefs cb WHERE cb.id = brief_generated_keywords.brief_id AND cb.client_id = get_my_client_id()
  ));

CREATE POLICY brief_keywords_update ON brief_generated_keywords FOR UPDATE
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM client_briefs cb WHERE cb.id = brief_generated_keywords.brief_id AND cb.client_id = get_my_client_id()
  ));

CREATE POLICY brief_keywords_delete ON brief_generated_keywords FOR DELETE
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM client_briefs cb WHERE cb.id = brief_generated_keywords.brief_id AND cb.client_id = get_my_client_id()
  ));

-- brief_recommended_sources — access follows parent brief
DROP POLICY IF EXISTS brief_sources_select ON brief_recommended_sources;
DROP POLICY IF EXISTS brief_sources_insert ON brief_recommended_sources;
DROP POLICY IF EXISTS brief_sources_update ON brief_recommended_sources;
DROP POLICY IF EXISTS brief_sources_delete ON brief_recommended_sources;

CREATE POLICY brief_sources_select ON brief_recommended_sources FOR SELECT
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM client_briefs cb WHERE cb.id = brief_recommended_sources.brief_id AND cb.client_id = get_my_client_id()
  ));

CREATE POLICY brief_sources_insert ON brief_recommended_sources FOR INSERT
  WITH CHECK (is_super_admin() OR EXISTS (
    SELECT 1 FROM client_briefs cb WHERE cb.id = brief_recommended_sources.brief_id AND cb.client_id = get_my_client_id()
  ));

CREATE POLICY brief_sources_update ON brief_recommended_sources FOR UPDATE
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM client_briefs cb WHERE cb.id = brief_recommended_sources.brief_id AND cb.client_id = get_my_client_id()
  ));

CREATE POLICY brief_sources_delete ON brief_recommended_sources FOR DELETE
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM client_briefs cb WHERE cb.id = brief_recommended_sources.brief_id AND cb.client_id = get_my_client_id()
  ));
