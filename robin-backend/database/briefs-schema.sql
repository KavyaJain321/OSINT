-- ============================================================
-- ROBIN OSINT — Briefs Schema
-- Stores client problem briefs and AI-generated keyword/source recommendations
-- ============================================================

-- Client problem briefs
CREATE TABLE IF NOT EXISTS client_briefs (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id            UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title                TEXT NOT NULL,
    problem_statement    TEXT NOT NULL,
    industry             TEXT,
    risk_domains         JSONB DEFAULT '[]',          -- ["regulatory","financial","reputational"]
    entities_of_interest JSONB DEFAULT '[]',          -- ["Company X","Person Y"]
    competitors          JSONB DEFAULT '[]',          -- ["Competitor A","Competitor B"]
    geographic_focus     JSONB DEFAULT '[]',          -- ["Pakistan","UAE"]
    status               TEXT DEFAULT 'processing',   -- processing|pending_review|approved|active|paused
    activated_at         TIMESTAMPTZ,
    created_by           UUID REFERENCES auth.users(id),
    created_at           TIMESTAMPTZ DEFAULT now(),
    updated_at           TIMESTAMPTZ DEFAULT now()
);

-- AI-generated keywords from brief analysis
CREATE TABLE IF NOT EXISTS brief_generated_keywords (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_id    UUID NOT NULL REFERENCES client_briefs(id) ON DELETE CASCADE,
    keyword     TEXT NOT NULL,
    category    TEXT NOT NULL,   -- primary|entity|semantic|competitive|temporal|negative
    priority    INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    rationale   TEXT,            -- why this keyword matters
    approved    BOOLEAN DEFAULT false,
    rejected    BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- AI-recommended sources from brief analysis
CREATE TABLE IF NOT EXISTS brief_recommended_sources (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_id          UUID NOT NULL REFERENCES client_briefs(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    url               TEXT NOT NULL,
    source_type       TEXT NOT NULL CHECK (source_type IN ('rss','html','browser','pdf','youtube')),
    rationale         TEXT,
    expected_hit_rate TEXT CHECK (expected_hit_rate IN ('high','medium','low')),
    approved          BOOLEAN DEFAULT false,
    rejected          BOOLEAN DEFAULT false,
    created_at        TIMESTAMPTZ DEFAULT now()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_client_briefs_client   ON client_briefs (client_id);
CREATE INDEX IF NOT EXISTS idx_client_briefs_status   ON client_briefs (status);
CREATE INDEX IF NOT EXISTS idx_brief_keywords_brief   ON brief_generated_keywords (brief_id);
CREATE INDEX IF NOT EXISTS idx_brief_keywords_approved ON brief_generated_keywords (brief_id, approved);
CREATE INDEX IF NOT EXISTS idx_brief_sources_brief    ON brief_recommended_sources (brief_id);
CREATE INDEX IF NOT EXISTS idx_brief_sources_approved ON brief_recommended_sources (brief_id, approved);

-- Auto-update updated_at on client_briefs
CREATE OR REPLACE FUNCTION update_brief_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_brief_updated_at
    BEFORE UPDATE ON client_briefs
    FOR EACH ROW EXECUTE FUNCTION update_brief_timestamp();
