-- ============================================================
-- ROBIN OSINT — Intelligence Engine Schema
-- Palantir-grade threat analysis, entity profiling, signals
-- Run in Supabase SQL Editor AFTER schema.sql
-- ============================================================

-- ============================================================
-- 1. threat_assessments — Multi-dimensional threat scoring
-- ============================================================
CREATE TABLE IF NOT EXISTS threat_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  assessment_date DATE NOT NULL,
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100) DEFAULT 0,
  dimensions JSONB NOT NULL DEFAULT '{"reputational":0,"financial":0,"regulatory":0,"operational":0,"geopolitical":0}',
  active_threats JSONB DEFAULT '[]',
  threat_velocity JSONB DEFAULT '{"rising":[],"stable":[],"declining":[]}',
  cascading_risks JSONB DEFAULT '[]',
  mitigation_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, assessment_date)
);

-- ============================================================
-- 2. entity_profiles — Persistent entity intelligence cards
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'org', 'location', 'figure')),
  aliases TEXT[] DEFAULT '{}',
  first_seen DATE,
  last_seen DATE,
  mention_count INTEGER DEFAULT 0,
  sentiment_profile JSONB DEFAULT '{"positive":0,"negative":0,"neutral":0,"trend":"stable"}',
  influence_score FLOAT DEFAULT 0,
  relationships JSONB DEFAULT '[]',
  risk_tags TEXT[] DEFAULT '{}',
  profile_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, entity_name, entity_type)
);

-- ============================================================
-- 3. intelligence_signals — Early warning system
-- ============================================================
CREATE TABLE IF NOT EXISTS intelligence_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'volume_spike', 'sentiment_shift', 'new_entity', 'entity_surge',
    'narrative_shift', 'cross_source_confirmation', 'threat_escalation',
    'entity_sentiment_flip', 'coordinated_coverage'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'watch', 'warning', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  related_entities TEXT[] DEFAULT '{}',
  related_articles UUID[] DEFAULT '{}',
  evidence JSONB DEFAULT '{}',
  is_acknowledged BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. source_reliability — Source bias & reliability tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS source_reliability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  reliability_score FLOAT DEFAULT 50,
  bias_direction TEXT DEFAULT 'center' CHECK (bias_direction IN ('left', 'center-left', 'center', 'center-right', 'right')),
  sentiment_skew JSONB DEFAULT '{}',
  factual_consistency FLOAT DEFAULT 50,
  article_count INTEGER DEFAULT 0,
  avg_importance FLOAT DEFAULT 0,
  last_evaluated TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (source_id, client_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_threat_assessments_client ON threat_assessments(client_id, assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_entity_profiles_client ON entity_profiles(client_id, influence_score DESC);
CREATE INDEX IF NOT EXISTS idx_entity_profiles_name ON entity_profiles(client_id, entity_name);
CREATE INDEX IF NOT EXISTS idx_intelligence_signals_client ON intelligence_signals(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intelligence_signals_severity ON intelligence_signals(severity, is_acknowledged);
CREATE INDEX IF NOT EXISTS idx_source_reliability_source ON source_reliability(source_id);
