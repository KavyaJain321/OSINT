-- ============================================================
-- ROBIN OSINT — Fix Missing RLS Policies
-- Run this in Supabase SQL Editor
-- Fixes all intelligence pipeline tables that were missing policies
-- ============================================================

-- Enable RLS on all missing tables
ALTER TABLE intelligence_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inference_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_reliability ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_expressions ENABLE ROW LEVEL SECURITY;

-- ── intelligence_signals ──────────────────────────────
DROP POLICY IF EXISTS intel_signals_select ON intelligence_signals;
DROP POLICY IF EXISTS intel_signals_insert ON intelligence_signals;
DROP POLICY IF EXISTS intel_signals_update ON intelligence_signals;
DROP POLICY IF EXISTS intel_signals_delete ON intelligence_signals;
CREATE POLICY intel_signals_select ON intelligence_signals FOR SELECT USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY intel_signals_insert ON intelligence_signals FOR INSERT WITH CHECK (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY intel_signals_update ON intelligence_signals FOR UPDATE USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY intel_signals_delete ON intelligence_signals FOR DELETE USING (is_super_admin() OR client_id = get_my_client_id());

-- ── entity_profiles ───────────────────────────────────
DROP POLICY IF EXISTS entity_profiles_select ON entity_profiles;
DROP POLICY IF EXISTS entity_profiles_insert ON entity_profiles;
DROP POLICY IF EXISTS entity_profiles_update ON entity_profiles;
DROP POLICY IF EXISTS entity_profiles_delete ON entity_profiles;
CREATE POLICY entity_profiles_select ON entity_profiles FOR SELECT USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY entity_profiles_insert ON entity_profiles FOR INSERT WITH CHECK (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY entity_profiles_update ON entity_profiles FOR UPDATE USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY entity_profiles_delete ON entity_profiles FOR DELETE USING (is_super_admin() OR client_id = get_my_client_id());

-- ── threat_assessments ────────────────────────────────
DROP POLICY IF EXISTS threat_select ON threat_assessments;
DROP POLICY IF EXISTS threat_insert ON threat_assessments;
DROP POLICY IF EXISTS threat_update ON threat_assessments;
DROP POLICY IF EXISTS threat_delete ON threat_assessments;
CREATE POLICY threat_select ON threat_assessments FOR SELECT USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY threat_insert ON threat_assessments FOR INSERT WITH CHECK (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY threat_update ON threat_assessments FOR UPDATE USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY threat_delete ON threat_assessments FOR DELETE USING (is_super_admin() OR client_id = get_my_client_id());

-- ── inference_chains ──────────────────────────────────
DROP POLICY IF EXISTS inference_select ON inference_chains;
DROP POLICY IF EXISTS inference_insert ON inference_chains;
DROP POLICY IF EXISTS inference_update ON inference_chains;
DROP POLICY IF EXISTS inference_delete ON inference_chains;
CREATE POLICY inference_select ON inference_chains FOR SELECT USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY inference_insert ON inference_chains FOR INSERT WITH CHECK (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY inference_update ON inference_chains FOR UPDATE USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY inference_delete ON inference_chains FOR DELETE USING (is_super_admin() OR client_id = get_my_client_id());

-- ── source_reliability ────────────────────────────────
DROP POLICY IF EXISTS src_reliability_select ON source_reliability;
DROP POLICY IF EXISTS src_reliability_insert ON source_reliability;
DROP POLICY IF EXISTS src_reliability_update ON source_reliability;
DROP POLICY IF EXISTS src_reliability_delete ON source_reliability;
CREATE POLICY src_reliability_select ON source_reliability FOR SELECT USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY src_reliability_insert ON source_reliability FOR INSERT WITH CHECK (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY src_reliability_update ON source_reliability FOR UPDATE USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY src_reliability_delete ON source_reliability FOR DELETE USING (is_super_admin() OR client_id = get_my_client_id());

-- ── content_items ─────────────────────────────────────
DROP POLICY IF EXISTS content_items_select ON content_items;
DROP POLICY IF EXISTS content_items_insert ON content_items;
DROP POLICY IF EXISTS content_items_update ON content_items;
DROP POLICY IF EXISTS content_items_delete ON content_items;
CREATE POLICY content_items_select ON content_items FOR SELECT USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY content_items_insert ON content_items FOR INSERT WITH CHECK (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY content_items_update ON content_items FOR UPDATE USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY content_items_delete ON content_items FOR DELETE USING (is_super_admin() OR client_id = get_my_client_id());

-- ── watch_expressions ─────────────────────────────────
DROP POLICY IF EXISTS watch_expr_select ON watch_expressions;
DROP POLICY IF EXISTS watch_expr_insert ON watch_expressions;
DROP POLICY IF EXISTS watch_expr_update ON watch_expressions;
DROP POLICY IF EXISTS watch_expr_delete ON watch_expressions;
CREATE POLICY watch_expr_select ON watch_expressions FOR SELECT USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY watch_expr_insert ON watch_expressions FOR INSERT WITH CHECK (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY watch_expr_update ON watch_expressions FOR UPDATE USING (is_super_admin() OR client_id = get_my_client_id());
CREATE POLICY watch_expr_delete ON watch_expressions FOR DELETE USING (is_super_admin() OR client_id = get_my_client_id());
