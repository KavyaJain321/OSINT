-- ============================================================
-- Migration 004: Watch Expressions
-- Advanced pattern matching beyond keywords: semantic queries,
-- entity+sentiment combos, and pattern rules
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS watch_expressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    brief_id UUID REFERENCES client_briefs(id) ON DELETE CASCADE,
    expression_type TEXT NOT NULL CHECK (expression_type IN (
        'semantic',           -- embedding similarity match
        'entity_sentiment',   -- entity + sentiment condition
        'pattern_rule',       -- field-based matching (importance, narrative_frame)
        'keyword_combo'       -- multiple keywords that must co-occur
    )),
    label TEXT NOT NULL,
    expression JSONB NOT NULL,
    -- semantic:         { "query": "government officials receiving large contracts", "threshold": 0.75 }
    -- entity_sentiment: { "entity": "Opposition Party", "sentiment": "negative", "min_importance": 6 }
    -- pattern_rule:     { "min_importance": 8, "narrative_frame": "crisis" }
    -- keyword_combo:    { "all": ["corruption", "minister"], "any": ["arrested", "FIR", "probe"] }
    is_active BOOLEAN DEFAULT true,
    match_count INTEGER DEFAULT 0,
    last_matched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup during analysis
CREATE INDEX IF NOT EXISTS idx_watch_expr_client ON watch_expressions(client_id, is_active);
CREATE INDEX IF NOT EXISTS idx_watch_expr_brief ON watch_expressions(brief_id);
